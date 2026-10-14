require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);


  
    
    
    
    
    
  






app.use(express.json());
app.use(express.static(__dirname));

function paymentClient() {
  if (!TOKEN || TOKEN.includes("COLE_SEU")) throw new Error("Configure MERCADO_PAGO_ACCESS_TOKEN no .env");
  return new Payment(new MercadoPagoConfig({ accessToken: TOKEN }));
}

app.post("/api/create-pix", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Informe um e-mail válido." });
    const orderId = crypto.randomUUID();
    const { error } = await supabase
  .from("pedidos")
  .insert({
    id: orderId,
    email: email,
    status: "pending"
  });

if (error) throw error;
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
    const { error: updateError } = await supabase
  .from("pedidos")
  .update({
    status: "pending",
    payment_id: String(payment.id)
  })
  .eq("id", orderId);

if (updateError) throw updateError;
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
  const payment = await paymentClient().get({
    id: paymentId
  });

  const orderId = String(payment.external_reference || "");

  if (!orderId || (expectedOrderId && orderId !== expectedOrderId)) {
    throw new Error("Pedido inválido");
  }

  const { data: order, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("Pedido não encontrado");
  }

  if (
    String(payment.transaction_amount) !== "40" ||
    String(order.payment_id) !== String(payment.id) ||
    payment.payment_method_id !== "pix"
  ) {
    throw new Error("Pagamento inválido");
  }

  let status = payment.status;

  if (!["approved", "pending", "in_process", "rejected", "cancelled", "refunded", "charged_back"].includes(status)) {
    status = "pending";
  }

  const { data: updated, error: updateError } = await supabase
    .from("pedidos")
    .update({ status })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError) throw updateError;

  return updated;
}

app.get("/api/order/:id", async (req, res) => {
  try {
    const orderId = String(req.params.id || "");
    const { data: order, error } = await supabase
  .from("pedidos")
  .select("*")
  .eq("id", orderId)
  .maybeSingle();

if (error) throw error;
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    if (order.payment_id) await refreshPayment(order.payment_id, orderId);
    const { data: fresh, error: freshError } = await supabase
  .from("pedidos")
  .select("*")
  .eq("id", orderId)
  .single();

if (freshError) throw freshError;
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
      if (orderId) {
  await refreshPayment(String(payment.id), orderId);
      }
    }
  } catch (e) {
    console.error("webhook verification:", e.message);
  }
});

app.get("/api/premium/:orderId", async (req, res) => {
  const { data: order, error } = await supabase
  .from("pedidos")
  .select("*")
  .eq("id", String(req.params.orderId))
  .maybeSingle();

if (error) {
  return res.status(500).json({ error: "Erro ao verificar pagamento" });
}
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
