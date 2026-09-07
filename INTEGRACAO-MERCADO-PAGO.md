# Ligar o Pix de verdade (Mercado Pago)

Hoje o funil já gera Pix em **modo demonstração** — QR e copia e cola aparecem,
mas ninguém é cobrado. Para cobrar de verdade, faltam só as credenciais.
São 4 passos, todos no painel do Mercado Pago.

---

## 1. Cadastre uma chave Pix na conta

Sem chave Pix cadastrada, a API recusa a cobrança.

1. Abra o app ou o site do Mercado Pago com a conta que vai **receber** o dinheiro.
2. Vá em **Seu negócio → Pix → Minhas chaves** (ou "Cobrar com Pix").
3. Cadastre pelo menos uma chave (CPF/CNPJ, e-mail ou telefone).

## 2. Crie uma aplicação e pegue o Access Token

1. Acesse <https://www.mercadopago.com.br/developers/panel/app>.
2. **Criar aplicação** → nome livre (ex.: "Funil Petição") →
   produto **Pagamentos online** → modelo **CheckoutAPI**.
3. Dentro da aplicação, abra **Credenciais de produção**.
4. Copie o **Access Token** (começa com `APP_USR-`).

> As **credenciais de teste** servem para simular pagamentos sem dinheiro real.
> O fluxo é idêntico — só troque o token. Para testar, crie um
> [usuário de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix)
> e pague o Pix com a conta de teste comprador.

## 3. Configure as variáveis de ambiente

**Local** — crie `web/.env.local` (o `.gitignore` já bloqueia esse arquivo):

```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
NEXT_PUBLIC_PIX_MODO_SIMULADO=false
```

**Produção (Vercel)** — *Settings → Environment Variables*, as mesmas chaves,
mais:

```
NEXT_PUBLIC_SITE_URL=https://seu-dominio.com.br
MERCADOPAGO_WEBHOOK_SECRET=...   (passo 4)
```

Depois de mudar qualquer variável: **redeploy**. O Next só lê env var na
inicialização.

| Variável | Para quê |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Único item obrigatório. Presente = Pix real; ausente = modo demonstração. |
| `NEXT_PUBLIC_PIX_MODO_SIMULADO` | Só controla textos da interface. Coloque `false` junto com o token. |
| `NEXT_PUBLIC_SITE_URL` | Domínio público, usado para montar a URL do webhook. Na Vercel é preenchido sozinho. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Valida a assinatura das notificações. Opcional, recomendado. |
| `PIX_EXPIRACAO_SEGUNDOS` | Validade do código. Mínimo aceito pelo MP: `1800` (30 min). |

## 4. Aponte o webhook (confirmação instantânea)

1. No painel da aplicação → **Webhooks / Notificações**.
2. URL de produção: `https://seu-dominio.com.br/api/pix/webhook`
3. Evento: **Pagamentos** (`payment`).
4. Copie a **chave secreta** que aparece e coloque em `MERCADOPAGO_WEBHOOK_SECRET`.

O webhook não é obrigatório: a tela também pergunta o status a cada 3 segundos.
Com ele, a confirmação chega no primeiro tick após o pagamento em vez de
depender de uma consulta que pode pegar o status desatualizado.

---

## Como o dinheiro caminha pelo código

```
/pagamento   escolhe o valor                     src/lib/etapas/pagamento.ts
/checkout    nome, CPF, WhatsApp, order bump     src/lib/etapas/checkout.ts
             └─ POST /api/pix/criar ────────────► POST api.mercadopago.com/v1/payments
/pix         QR + copia e cola + cronômetro      src/app/pix/PixClient.tsx
             └─ GET /api/pix/status (3 em 3s) ──► GET  /v1/payments/{id}
                     ▲
                     └── webhook do MP ─────────► POST /api/pix/webhook
/compartilhar → /obrigado   depois da aprovação
```

Arquivos que importam:

| Arquivo | Papel |
|---|---|
| `src/lib/pix-provider.server.ts` | Fala com o Mercado Pago. **Só o servidor importa** — é onde o token vive. |
| `src/lib/pix-store.server.ts` | Memória curta do desfecho recebido pelo webhook. |
| `src/lib/pix-client.ts` | O que o navegador usa: criar, consultar, guardar a transação na sessão. |
| `src/app/pix/PixClient.tsx` | A tela de pagamento. |
| `src/app/api/pix/*` | As três rotas: `criar`, `status`, `webhook`. |

O valor cobrado é **o valor escolhido em `/pagamento` + R$ 4,99 se o order bump
estiver marcado** — a soma é calculada em `checkout.ts` e revalidada contra
`CONFIG.contribuicao.valorMinimo/valorMaximo` no servidor, para que ninguém
consiga chamar a API direto com um valor fora da faixa.

---

## Testar

```bash
cd web
npm run dev
```

1. Percorra o funil até `/pagamento`, escolha um valor, continue.
2. Preencha o checkout (CPF válido) e clique em **Gerar Pix agora**.
3. Você cai em `/pix`: copie o código ou leia o QR no app do banco.
4. Pague. Em poucos segundos a tela vira sozinha e segue para o compartilhamento.

Sem token configurado, o passo 4 não acontece sozinho (não há cobrança real) —
use o botão **"Já fiz o pagamento"** para percorrer o resto do funil.

### Quando der errado

| Sintoma | Causa quase sempre |
|---|---|
| "Não foi possível gerar o Pix" | Token errado/expirado, ou conta sem chave Pix. O motivo real sai no log do servidor (e na resposta, fora de produção). |
| `date_of_expiration` recusado | Expiração abaixo de 30 min. Já tratado no código, mas confira `PIX_EXPIRACAO_SEGUNDOS`. |
| QR aparece mas nunca confirma | Webhook não configurado **e** token de teste pagando com conta real (ou vice-versa) — os dois lados precisam ser do mesmo ambiente. |
| Cobrança duplicada | Não deve acontecer: cada criação manda um `X-Idempotency-Key` próprio. |

## Referência

- [Integrar Pix — Checkout API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix)
- [Notificações / Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Compra de teste com Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix)
