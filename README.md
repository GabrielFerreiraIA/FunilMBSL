# Funil de Petição — Next.js + TypeScript

Migração do funil estático (pasta `../clone/`) para Next.js App Router com
TypeScript. **O motivo real da migração**: você vai plugar uma API de Pix cujo
token não pode aparecer no navegador — isso exige um servidor. Next.js na
Vercel dá esse servidor (Route Handlers) no mesmo projeto, sem precisar subir
nada à parte.

O visual é byte-a-byte o mesmo capture do Change.org. Nada do markup foi
redesenhado.

---

## Rodar

```bash
cd web
npm install
npm run dev
# http://localhost:3000
```

`npm run build && npm run start` roda em modo produção (é o que a Vercel faz).

Sem nenhuma variável de ambiente configurada, o Pix funciona em **modo
demonstração** (QR de teste) — o site inteiro roda pronto para uso.

---

## Por que Next.js (e não só "trocar a pasta")

1. **Rotas de API server-side.** `app/api/pix/criar/route.ts` e
   `app/api/pix/status/route.ts` rodam no servidor da Vercel. A chave do seu
   provedor de pagamento fica numa variável de ambiente que **só o servidor
   lê** — nunca chega ao navegador, nunca aparece no "Ver código-fonte".
2. **TypeScript.** Toda a lógica (`src/lib/**`) é tipada — erros de contrato
   (um campo que devia existir e não existe) viram erro de build, não bug em
   produção.
3. **Deploy Vercel sem configuração.** `git push` → build → no ar. Não precisa
   de `vercel.json`, é a stack nativa deles.

---

## Como o visual foi preservado

As 6 páginas capturadas (`public/content/*.html`) são exatamente o HTML que
você me passou, com um único ajuste: neutralizei um atributo de Shadow DOM
declarativo (`shadowrootmode`) usado por um player de vídeo (Mux) em duas
páginas — mantendo com isso o React livre para nunca precisar reconciliar
essa parte da árvore. **O único efeito colateral visível** é que a moldura do
player de vídeo de depoimento (na petição e no formulário) não ativa seu
próprio chrome interno — o resto da página é idêntico. Removi também, em
todas as páginas, um bloco de ~0×0px injetado por uma extensão de navegador
("Bigeye", um downloader de mídia) que tinha sido capturado por acidente
junto com a página — não fazia parte do site real.

Comparação de altura de página (clone estático vs. Next.js), pixel a pixel:

```
peticao        clone=13016px  next=13016px  IGUAL
turbinar       clone=1709px   next=1709px   IGUAL
compartilhar   clone=1282px   next=1282px   IGUAL
```

### Como o conteúdo chega à tela

Cada rota (`app/page.tsx`, `app/assinar/page.tsx`, ...) é um componente de
servidor minúsculo que só define o `<title>` da aba e renderiza
`<FunilPagina arquivo="..." etapa="..." />`.

`FunilPagina` (`src/components/FunilPagina.tsx`) é quem faz o trabalho:
1. Busca o HTML capturado em `public/content/<arquivo>.html` (um asset
   estático comum, cacheável).
2. Injeta no DOM.
3. **Só depois disso** liga o comportamento da etapa (formulário, Pix,
   compartilhamento...).

Isso é client-side de propósito: o capture carrega estruturas (Shadow DOM
declarativo, componentes de vídeo) que o processo de hidratação do React não
consegue verificar com segurança se renderizadas no servidor — o navegador
reorganiza essa parte da árvore de um jeito que o React não antecipa,
travando a hidratação (erro #418). Buscando e injetando via `fetch()` já no
cliente, isso deixa de ser um risco, seja lá o que exista dentro do capture.

---

## Estrutura

```
web/
├── public/content/*.html        os 6 capturas, intocados (servidos como estáticos)
├── src/
│   ├── app/
│   │   ├── layout.tsx            shell + SLOT de pixels
│   │   ├── page.tsx               etapa 1 · petição      (/)
│   │   ├── assinar/page.tsx       etapa 2 · formulário    (/assinar)
│   │   ├── turbinar/page.tsx      etapa 3 · upsell        (/turbinar)
│   │   ├── pagamento/page.tsx     etapa 4a · valor        (/pagamento)
│   │   ├── checkout/page.tsx      etapa 4b · dados        (/checkout)
│   │   ├── pix/page.tsx           etapa 4c · pagamento    (/pix)  JSX próprio
│   │   ├── compartilhar/page.tsx  etapa 5                 (/compartilhar)
│   │   ├── comentario/page.tsx    etapa 6                 (/comentario)
│   │   ├── obrigado/page.tsx      confirmação (JSX próprio, não é capture)
│   │   └── api/
│   │       ├── pix/criar/route.ts     ← gera a cobrança (servidor)
│   │       ├── pix/status/route.ts    ← consulta status (servidor)
│   │       ├── pix/webhook/route.ts   ← recebe a confirmação do Mercado Pago
│   │       ├── assinaturas/route.ts   ← pronto para persistir (hoje só loga)
│   │       └── comentarios/route.ts   ← idem
│   ├── components/
│   │   └── FunilPagina.tsx        busca + injeta + liga o comportamento
│   └── lib/
│       ├── config.ts              ← COMECE AQUI: campanha, valores, tracking
│       ├── dados.ts                nomes/doações reais (ticker de notificações)
│       ├── estado.ts               lead + UTMs (sessionStorage)
│       ├── navegacao.ts            ir(etapa), blindagem de etapas protegidas
│       ├── track.ts                eventos → GTM/GA4/Meta/TikTok/UTMify
│       ├── notificacoes.ts         ticker "Fulano acabou de assinar"
│       ├── dom.ts                  qa(), aoClicar(), toast(), neutralizarExternos()
│       ├── pix-client.ts           chama /api/pix/* — nunca vê a chave do PSP
│       ├── pix-provider.server.ts  ★ SÓ o servidor importa — aqui mora a chave
│       ├── pix-store.server.ts     memória curta do que o webhook já confirmou
│       └── etapas/*.ts             lógica de cada etapa (uma função por etapa)
```

---

## A API de Pix — o motivo desta migração

`src/lib/pix-provider.server.ts` **nunca é enviado ao navegador** — só as
rotas de API o importam. Sem env vars, cai em modo demonstração
automaticamente. Hoje vem com **Mercado Pago** implementado como exemplo
funcional (é o PSP mais comum no Brasil para Pix via API).

### Ativar o Mercado Pago

Passo a passo completo (chave Pix, credenciais, webhook e como testar) em
**[INTEGRACAO-MERCADO-PAGO.md](INTEGRACAO-MERCADO-PAGO.md)**. O resumo:

1. Cadastre uma **chave Pix** na conta que vai receber — sem ela a API recusa
   a cobrança.
2. Pegue o **Access Token** da sua aplicação em
   [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app)
3. Configure as env vars (local: `.env.local`; produção: painel da Vercel →
   Project Settings → Environment Variables):
   ```
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
   NEXT_PUBLIC_PIX_MODO_SIMULADO=false
   NEXT_PUBLIC_SITE_URL=https://seu-dominio.com.br
   ```
4. Aponte o webhook do painel para `/api/pix/webhook` (evento "Pagamentos") e
   guarde a chave secreta em `MERCADOPAGO_WEBHOOK_SECRET`.

Nenhum código muda entre demonstração e produção: o front continua chamando
`/api/pix/criar` e `/api/pix/status`; é a rota que passa a falar com o Mercado
Pago de verdade.

### Usar outro provedor (Efí, Asaas, PagBank...)

Abra `src/lib/pix-provider.server.ts` e implemente uma função equivalente a
`criarViaMercadoPago` / `statusViaMercadoPago` para o seu provedor, e ajuste
`escolherProvedor()` (as funções `temMercadoPago()` no arquivo) para checar a
env var do seu PSP. O contrato que as rotas de API esperam de volta:

```ts
interface PixTransacao {
  id: string;
  qrCodeBase64: string | null;  // pode vir null — o front desenha um placeholder
  copiaECola: string;            // obrigatório
  expiraEm: string;              // ISO 8601
  simulado: boolean;
}
```

> **Nunca** chame a API do PSP a partir do navegador. `src/lib/pix-client.ts`
> (o único módulo que o cliente importa) só fala com `/api/pix/*` — está
> assim de propósito, não mude isso.

---

## Deploy na Vercel

```bash
npm i -g vercel   # se ainda não tiver
cd web
vercel            # primeira vez: linka o projeto
vercel --prod     # publica em produção
```

Ou, mais simples: conecte o repositório no [vercel.com/new](https://vercel.com/new)
— toda vez que você der `git push`, ela builda e publica sozinha. Não
esqueça de configurar `MERCADOPAGO_ACCESS_TOKEN` (e as demais env vars do
`.env.example`) no painel do projeto antes do primeiro deploy real.

---

## Tracking

Cole os pixels no **SLOT 1** do `src/app/layout.tsx`, usando `next/script`:

```tsx
import Script from 'next/script';

<Script
  src="https://cdn.utmify.com.br/scripts/utms/latest.js"
  strategy="afterInteractive"
  data-utmify-prevent-xcod-sck
/>
```

Os eventos e o mapeamento para cada plataforma estão em `src/lib/track.ts` —
mesma tabela de antes:

| Evento | Meta | GA4 |
|---|---|---|
| `view_peticao` | ViewContent | view_item |
| `click_assinar` | Lead | select_promotion |
| `view_form` | InitiateCheckout | begin_checkout |
| `assinatura` | CompleteRegistration | sign_up |
| `view_upsell` | ViewContent | view_promotion |
| `aceite_upsell` / `recusa_upsell` | AddToCart / — | add_to_cart |
| `valor_selecionado` | AddPaymentInfo | add_payment_info |
| `pix_gerado` / `pix_copiado` | AddPaymentInfo / — | generate_pix |
| **`pagamento_ok`** | **Purchase** | **purchase** |
| `compartilhou` | — | share |
| `comentario` | — | post_comment |

Escutar de fora: `document.addEventListener('funil:pagamento_ok', e => ...)`.
Depurar: `window.FUNIL_DEBUG = true` no console.

---

## O que preservei do projeto anterior

- Impacto proporcional ao valor escolhido na etapa 4 (`pessoasPorReal` em
  `config.ts`)
- Ticker de notificações ao vivo, com o mesmo ritmo deliberadamente lento
  (`config.notificacoes`)
- Detecção automática do formulário de nome único vs. nome+sobrenome
- O botão "Continuar" injetado quando o capture de compartilhamento não traz
  um botão nativo de avançar
- A blindagem de etapas (quem abre `/pagamento` direto, sem ter assinado,
  volta para a petição)
- Neutralização de links externos para change.org

## O que é novo nesta migração

- TypeScript em tudo
- As rotas `/api/pix/*` — o ponto principal desta migração
- Metadados (`<title>`, `robots`) via o sistema de metadata do Next em vez de
  tags soltas
- `robots: noindex` automaticamente nas etapas 2–7 (só a petição, etapa 1,
  fica indexável)

## Antes de publicar

1. **Configure `MERCADOPAGO_ACCESS_TOKEN`** (ou implemente seu provedor) —
   sem isso, todo pagamento é simulado.
2. **Troque `campanha.urlPublica`** em `config.ts` pelo seu domínio real —
   hoje aponta para o change.org original.
3. **Os nomes em `dados.ts`** são de pessoas reais que assinaram no
   Change.org — troque antes de publicar.
4. **O botão "Já fiz o pagamento"** dispara o evento de compra no clique.
   Funciona como escape para o modo demonstração; com o Mercado Pago
   configurado, o webhook + o polling de `/api/pix/status` já confirmam
   sozinhos — remova esse botão de `src/app/pix/PixClient.tsx` se quiser
   exigir confirmação real antes de avançar (o evento `pagamento_ok` distingue
   os dois casos pelo campo `confirmacao`).
