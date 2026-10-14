require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const db = new Database("treino-plus.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const saveOrder = db.prepare("INSERT INTO orders (id,email,status) VALUES (?,?, 'pending')");
const getOrder = db.prepare("SELECT id,email,status FROM orders WHERE id=?");
const updateOrder = db.prepare("UPDATE orders SET status=?, payment_id=? WHERE id=?");
const findByPayment = db.prepare("SELECT id FROM orders WHERE id=?");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function paymentClient() {
  if (!TOKEN || TOKEN.includes("COLE_SEU")) throw new Error("Configure MERCADO_PAGO_ACCESS_TOKEN no .env");
  return new Payment(new MercadoPagoConfig({ accessToken: TOKEN }));
}

app.post("/api/create-pix", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Informe um e-mail válido." });
    const orderId = crypto.randomUUID();
    saveOrder.run(orderId, email);
    const payment = await paymentClient().create({
      body: {
        transaction_amount: 40,
        description: "Treino+ - acesso premium",
        payment_method_id: "pix",
        payer: { email },
        external_reference: orderId,
        notification_url: `${BASE_URL}/webhooks/mercadopago`,
        metadata: { order_id: orderId, product: "treino-plus-premium" }
      }
    });
    updateOrder.run("pending", String(payment.id), orderId);
    const tx = payment.point_of_interaction?.transaction_data || {};
    res.json({
      orderId,
      paymentId: String(payment.id),
      status: payment.status,
      pixCopyPaste: tx.qr_code || "",
      qrCodeBase64: tx.qr_code_base64 || "",
      ticketUrl: tx.ticket_url || ""
    });
  } catch (e) {
    console.error("create-pix:", e.message);
    res.status(500).json({ error: "Não foi possível gerar o Pix. Confira a configuração do Mercado Pago e tente novamente." });
  }
});

async function refreshPayment(paymentId, expectedOrderId) {
  const payment = await paymentClient().get({ id: paymentId });
  const orderId = String(payment.external_reference || "");
  if (!orderId || (expectedOrderId && orderId !== expectedOrderId)) return null;
  const order = getOrder.get(orderId);
  if (!order || String(payment.transaction_amount) !== "40" || payment.payment_method_id !== "pix") return null;
  // Nunca liberar acesso por redirect do navegador: somente status confirmado consultado na API.
  if (payment.status === "approved") updateOrder.run("approved", String(payment.id), orderId);
  else if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
    updateOrder.run(payment.status, String(payment.id), orderId);
  }
  return getOrder.get(orderId);
}

app.get("/api/order/:id", async (req, res) => {
  try {
    const orderId = String(req.params.id || "");
    const order = getOrder.get(orderId);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    if (order.payment_id) await refreshPayment(order.payment_id, orderId);
    const fresh = getOrder.get(orderId);
    res.json({ orderId: fresh.id, status: fresh.status, premium: fresh.status === "approved" });
  } catch (e) {
    console.error("order status:", e.message);
    res.status(502).json({ error: "Não foi possível consultar o pagamento agora." });
  }
});

app.post("/webhooks/mercadopago", async (req, res) => {
  // O webhook é apenas um aviso. O servidor consulta a API oficial antes de atualizar o pedido.
  res.sendStatus(200);
  try {
    const paymentId = req.body?.data?.id || req.query?.["data.id"];
    const type = req.body?.type || req.query?.type;
    if (paymentId && (!type || type === "payment")) {
      const payment = await paymentClient().get({ id: String(paymentId) });
      const orderId = String(payment.external_reference || "");
      if (orderId && findByPayment.get(orderId)) await refreshPayment(String(paymentId), orderId);
    }
  } catch (e) {
    console.error("webhook verification:", e.message);
  }
});

app.get("/api/premium/:orderId", (req, res) => {
  const order = getOrder.get(String(req.params.orderId || ""));
  if (!order || order.status !== "approved") return res.status(403).json({ error: "Acesso premium bloqueado até a confirmação do Pix." });
  res.json({
    title: "Área Premium Treino+",
    workouts: [
      { name: "Treino A — Pernas e glúteos", level: "Iniciante/intermediário", sets: "3 séries de 10–12 repetições", rest: "60–90 segundos", note: "Use carga controlada e mantenha a técnica. Ajuste ao seu nível." },
      { name: "Treino B — Peito, ombros e tríceps", level: "Iniciante/intermediário", sets: "3 séries de 8–12 repetições", rest: "60–90 segundos", note: "Aqueça antes e interrompa se sentir dor aguda." },
      { name: "Treino C — Costas e bíceps", level: "Iniciante/intermediário", sets: "3 séries de 8–12 repetições", rest: "60–90 segundos", note: "Priorize a execução correta e aumente a carga gradualmente." },
      { name: "Treino D — Corpo inteiro", level: "Iniciante", sets: "2–3 séries por exercício", rest: "60–90 segundos", note: "Inclua dias de recuperação conforme sua necessidade." }
    ],
    recipes: [
      { name: "Frango com batata-doce", time: "30 min", ingredients: ["Peito de frango", "Batata-doce", "Brócolis", "Azeite e temperos"], method: "Asse ou grelhe o frango, cozinhe a batata-doce e sirva com brócolis." },
      { name: "Panqueca de aveia", time: "15 min", ingredients: ["1 banana", "1 ovo", "2 colheres de aveia", "Canela opcional"], method: "Amasse a banana, misture com ovo e aveia e doure em frigideira antiaderente." },
      { name: "Omelete colorida", time: "10 min", ingredients: ["2 ovos", "Tomate", "Espinafre", "Temperos"], method: "Bata os ovos, junte os vegetais e cozinhe em fogo baixo até firmar." },
      { name: "Iogurte com frutas", time: "5 min", ingredients: ["Iogurte natural", "Fruta picada", "Aveia ou sementes"], method: "Misture os ingredientes e sirva na hora." }
    ]
  });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`Treino+ rodando na porta ${PORT}`));
