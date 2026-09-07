/* =============================================================================
   PROVEDOR DE PIX — SÓ RODA NO SERVIDOR
   -----------------------------------------------------------------------------
   Este arquivo NUNCA é enviado ao navegador (é importado somente pelas rotas
   de API em app/api/pix/*). É aqui, e só aqui, que uma chave de API deveria
   aparecer — lida de variáveis de ambiente, nunca hardcoded.

   Sem nenhuma env var configurada, cai automaticamente no modo demonstração —
   o site funciona pronto para uso, e vira "de verdade" no dia em que você
   configurar MERCADOPAGO_ACCESS_TOKEN.

   Integração: Checkout API / Pagamentos — POST /v1/payments com
   payment_method_id "pix".
   https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
   ============================================================================= */

import QRCode from 'qrcode';
import { marcarPago, statusConhecido } from './pix-store.server';

export interface PixInput {
  valor: number;
  nome?: string;
  email?: string;
  cpf?: string | null;
  campanha?: string;
  utms?: Record<string, string>;
}

export interface PixTransacao {
  id: string;
  qrCodeBase64: string | null;
  copiaECola: string;
  expiraEm: string; // ISO 8601
  simulado: boolean;
  /** Página de pagamento hospedada pelo Mercado Pago (plano B, se o QR falhar). */
  ticketUrl?: string | null;
}

export type PixStatus = 'pendente' | 'pago' | 'expirado';

/* O Mercado Pago exige que a expiração fique entre 30 minutos e 30 dias da
   emissão. Qualquer valor menor é recusado, então o piso de 1800s é aplicado
   aqui em vez de confiar no que vier da env var. */
const MINIMO_SEGUNDOS = 1800;
const EXPIRACAO_SEGUNDOS = Math.max(
  MINIMO_SEGUNDOS,
  Number(process.env.PIX_EXPIRACAO_SEGUNDOS ?? MINIMO_SEGUNDOS) || MINIMO_SEGUNDOS
);

/** ISO 8601 com offset explícito (-03:00), formato que a API do MP espera. */
function dataComOffset(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? '+' : '-';
  const p = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `.${String(d.getMilliseconds()).padStart(3, '0')}` +
    `${sinal}${p(off / 60)}:${p(off % 60)}`
  );
}

/** Gera o PNG do QR a partir do copia e cola — usado quando o PSP não devolve imagem. */
async function qrDoTexto(texto: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(texto, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 480,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch {
    return null;
  }
}

/* -----------------------------------------------------------------------------
   MODO DEMONSTRAÇÃO — usado quando nenhuma env var de PSP está configurada
   ----------------------------------------------------------------------------- */
async function criarDemo(input: PixInput): Promise<PixTransacao> {
  const payload =
    '00020126580014BR.GOV.BCB.PIX0136DEMO-' + (input.campanha ?? 'campanha') + '-' + input.valor +
    '5204000053039865802BR5913DEMONSTRACAO6009SAO PAULO62070503***6304DEMO';
  return {
    id: 'demo_' + Date.now(),
    qrCodeBase64: await qrDoTexto(payload),
    copiaECola: payload,
    expiraEm: new Date(Date.now() + EXPIRACAO_SEGUNDOS * 1000).toISOString(),
    simulado: true,
    ticketUrl: null
  };
}

function statusDemo(): { status: PixStatus } {
  // Em demonstração não há confirmação automática — quem avança na tela é o
  // botão "Já fiz o pagamento", então aqui basta nunca virar "pago" sozinho.
  return { status: 'pendente' };
}

/* -----------------------------------------------------------------------------
   MERCADO PAGO — https://www.mercadopago.com.br/developers/pt/reference
   Exige a env var MERCADOPAGO_ACCESS_TOKEN (Access Token da sua aplicação).
   ----------------------------------------------------------------------------- */
const MP_BASE = 'https://api.mercadopago.com';

/** URL pública do site — necessária para o MP conseguir chamar nosso webhook. */
function urlBase(): string | null {
  const bruta =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!bruta) return null;
  const url = bruta.startsWith('http') ? bruta : `https://${bruta}`;
  // O MP recusa URLs de notificação em localhost — só manda em ambiente público.
  if (/localhost|127\.0\.0\.1/.test(url)) return null;
  return url.replace(/\/+$/, '');
}

async function criarViaMercadoPago(input: PixInput): Promise<PixTransacao> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN!;
  const [primeiroNome, ...resto] = (input.nome ?? 'Apoiador').trim().split(/\s+/);
  const cpf = (input.cpf ?? '').replace(/\D/g, '');
  const base = urlBase();

  const corpo: Record<string, unknown> = {
    // O MP arredonda em 2 casas; garantimos isso antes de enviar.
    transaction_amount: Math.round(input.valor * 100) / 100,
    description: `Contribuição — ${input.campanha ?? 'petição'}`,
    payment_method_id: 'pix',
    external_reference: `${input.campanha ?? 'campanha'}:${input.email ?? 'anon'}`,
    date_of_expiration: dataComOffset(new Date(Date.now() + EXPIRACAO_SEGUNDOS * 1000)),
    payer: {
      email: input.email || 'sem-email@example.com',
      first_name: primeiroNome || 'Apoiador',
      last_name: resto.join(' ') || '-',
      ...(cpf.length === 11 ? { identification: { type: 'CPF', number: cpf } } : {})
    },
    metadata: {
      campanha: input.campanha ?? null,
      ...(input.utms ?? {})
    }
  };
  if (base) corpo.notification_url = `${base}/api/pix/webhook`;

  const resp = await fetch(`${MP_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      // Evita cobrança duplicada em caso de retry de rede.
      'X-Idempotency-Key': `${input.campanha ?? 'campanha'}-${input.email ?? 'anon'}-${Date.now()}`
    },
    body: JSON.stringify(corpo),
    cache: 'no-store'
  });

  const texto = await resp.text();
  if (!resp.ok) {
    throw new Error(`Mercado Pago recusou a cobrança (HTTP ${resp.status}): ${texto.slice(0, 500)}`);
  }

  const json = JSON.parse(texto) as {
    id: number;
    status?: string;
    date_of_expiration?: string;
    point_of_interaction?: {
      transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
    };
  };

  const dados = json.point_of_interaction?.transaction_data;
  if (!dados?.qr_code) {
    throw new Error(
      'Mercado Pago não devolveu o código Pix. Verifique se a conta tem uma chave Pix ' +
      'cadastrada e se o Access Token é o de produção da aplicação.'
    );
  }

  return {
    id: String(json.id),
    qrCodeBase64: dados.qr_code_base64
      ? `data:image/png;base64,${dados.qr_code_base64.replace(/^data:image\/\w+;base64,/, '')}`
      : await qrDoTexto(dados.qr_code),
    copiaECola: dados.qr_code,
    expiraEm: json.date_of_expiration ?? new Date(Date.now() + EXPIRACAO_SEGUNDOS * 1000).toISOString(),
    simulado: false,
    ticketUrl: dados.ticket_url ?? null
  };
}

/** Traduz o status do MP para os três estados que o funil conhece. */
export function traduzirStatus(status: string | undefined): PixStatus {
  const mapa: Record<string, PixStatus> = {
    approved: 'pago',
    authorized: 'pago',
    pending: 'pendente',
    in_process: 'pendente',
    in_mediation: 'pendente',
    cancelled: 'expirado',
    rejected: 'expirado',
    refunded: 'expirado',
    charged_back: 'expirado'
  };
  return mapa[status ?? ''] ?? 'pendente';
}

export async function buscarPagamentoMP(id: string): Promise<{ status?: string }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN!;
  const resp = await fetch(`${MP_BASE}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!resp.ok) throw new Error(`Mercado Pago: falha ao consultar status (HTTP ${resp.status})`);
  return resp.json() as Promise<{ status?: string }>;
}

async function statusViaMercadoPago(id: string): Promise<{ status: PixStatus }> {
  const json = await buscarPagamentoMP(id);
  const status = traduzirStatus(json.status);
  if (status === 'pago') marcarPago(id);
  return { status };
}

/* -----------------------------------------------------------------------------
   PONTO DE ENTRADA — escolhe o provedor pelas env vars presentes
   ----------------------------------------------------------------------------- */
export function temMercadoPago(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

export async function criarCobranca(input: PixInput): Promise<PixTransacao> {
  if (temMercadoPago()) return criarViaMercadoPago(input);
  return criarDemo(input);
}

export async function consultarStatus(id: string): Promise<{ status: PixStatus }> {
  // O webhook pode ter chegado antes da nossa consulta — se já sabemos o
  // desfecho, respondemos na hora e poupamos uma chamada à API do MP.
  const jaSabido = statusConhecido(id);
  if (jaSabido) return { status: jaSabido };

  if (temMercadoPago() && !id.startsWith('demo_')) return statusViaMercadoPago(id);
  return statusDemo();
}
