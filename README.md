# Treino+ — site com acesso premium Pix

Projeto inicial funcional com site responsivo, conteúdo premium servido pelo backend e integração Pix via Mercado Pago. O preço está fixado em R$ 40,00. O frontend nunca decide sozinho se o pagamento foi aprovado: consulta o backend, que consulta a API do Mercado Pago.

## Requisitos
- Node.js 20+
- Conta Mercado Pago de vendedor/recebedor com credenciais de produção
- Hospedagem que execute Node.js e permita HTTPS e armazenamento persistente

## Rodar localmente
1. Instale Node.js 20 ou superior.
2. Descompacte o projeto e abra a pasta no terminal.
3. Rode `npm install`.
4. Copie `.env.example` para `.env`.
5. Preencha `MERCADO_PAGO_ACCESS_TOKEN` com a credencial de teste inicialmente e `BASE_URL` com a URL pública HTTPS quando publicar.
6. Rode `npm start` e abra `http://localhost:3000`.

Para testes locais, o webhook de produção não alcançará seu computador sem uma URL pública/túnel HTTPS. Não use credenciais de produção durante testes.

## Antes de vender
1. No painel Mercado Pago, obtenha o Access Token correto. Nunca coloque esse token no HTML, no navegador, no GitHub público ou em mensagens.
2. Publique em hospedagem Node.js com HTTPS, configure `BASE_URL` para o domínio real e configure o webhook `https://SEU-DOMINIO.com/webhooks/mercadopago` no painel.
3. Faça pagamentos de teste seguindo o fluxo oficial do Mercado Pago; confirme que pedidos pendentes não abrem a área premium e que somente `approved` libera.
4. Use armazenamento persistente para o arquivo SQLite. Não use hospedagem que apague o disco ao reiniciar.
5. Antes de produção, implemente validação de assinatura do webhook conforme a documentação atual do Mercado Pago, rate limiting, logs sem dados sensíveis, política de privacidade/LGPD, termos de uso, suporte e fluxo de reembolso.
6. Considere que este MVP usa um identificador de pedido como chave de acesso no navegador. Para vender em escala, acrescente login, vínculo do pedido à conta do comprador e recuperação segura do acesso.
7. Confira o tratamento fiscal, taxas do provedor, regras de cancelamento/reembolso e a descrição do produto antes de anunciar.

## O que já está implementado
- Página inicial responsiva e apresentação do produto.
- Criação de pagamento Pix de R$ 40,00 pelo backend Mercado Pago.
- Exibição de QR Code e código Pix Copia e Cola, quando retornados pela API.
- Endpoint de webhook que consulta o pagamento diretamente na API antes de atualizar o pedido.
- Consulta periódica de status e liberação dos treinos/receitas somente quando a API informa `approved`.
- Conteúdo premium é servido pelo backend, não embutido na página pública.

## Limitações importantes
Este é um starter/MVP e não está publicado nem conectado à sua conta Mercado Pago. Sem credenciais válidas, domínio HTTPS e configuração de webhook, não gera cobranças reais. O endpoint de webhook responde ao aviso e confirma o status consultando a API, mas ainda precisa da validação criptográfica da assinatura do webhook recomendada pelo Mercado Pago antes de uso comercial. Não anuncie como pronto para produção até concluir a checklist.
