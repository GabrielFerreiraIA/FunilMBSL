/* =============================================================================
   PIX — LADO DO CLIENTE
   -----------------------------------------------------------------------------
   Fala SÓ com as rotas /api/pix/* do próprio site. Nunca vê a chave do PSP —
   ela mora em src/lib/pix-provider.server.ts, que só o servidor importa.
   ============================================================================= */

import { CONFIG } from './config';

export interface PixTransacao {
  id: string;
  qrCodeBase64: string | null;
  copiaECola: string;
  expiraEm: string;
  simulado: boolean;
  ticketUrl?: string | null;
}

export interface PixInput {
  valor: number;
  nome?: string;
  email?: string;
  cpf?: string | null;
}

let pollingId: ReturnType<typeof setInterval> | null = null;

export async function criarPix(input: PixInput, campanhaId: string, utms: Record<string, string>): Promise<PixTransacao> {
  const resp = await fetch('/api/pix/criar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, campanha: campanhaId, utms })
  });
  if (!resp.ok) {
    const corpo = await resp.json().catch(() => ({}));
    throw new Error(corpo?.detalhe || corpo?.erro || `Falha ao gerar Pix (HTTP ${resp.status})`);
  }
  return resp.json();
}

/** Confirmação automática. Em modo demonstração o servidor nunca retorna "pago" — quem avança é o botão "Já fiz o pagamento". */
export function aguardarPagamento(id: string, aoPagar: () => void, aoExpirar: () => void): void {
  pararPolling();
  pollingId = setInterval(async () => {
    try {
      const r = await fetch(`/api/pix/status?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const { status } = await r.json();
      if (status === 'pago') { pararPolling(); aoPagar(); }
      else if (status === 'expirado') { pararPolling(); aoExpirar(); }
    } catch { /* rede instável — tenta de novo no próximo tick */ }
  }, CONFIG.pix.intervaloPolling);
}

export function pararPolling(): void {
  if (pollingId) { clearInterval(pollingId); pollingId = null; }
}

/* -----------------------------------------------------------------------------
   TRANSAÇÃO EM CURSO
   A tela de pagamento (/pix) é uma página separada: a cobrança criada no
   checkout viaja até lá pela sessão, não pela URL — o copia e cola é um dado
   de pagamento e não tem por que aparecer na barra de endereços nem no
   histórico do navegador.
   ----------------------------------------------------------------------------- */
const CHAVE_TX = 'funil_pix_tx';

export function guardarTransacao(tx: PixTransacao, valor: number): void {
  try {
    window.sessionStorage.setItem(CHAVE_TX, JSON.stringify({ ...tx, valor }));
  } catch { /* sessionStorage bloqueado — a tela de /pix vai avisar e oferecer refazer */ }
}

export function lerTransacao(): (PixTransacao & { valor: number }) | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_TX);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function limparTransacao(): void {
  try { window.sessionStorage.removeItem(CHAVE_TX); } catch { /* nada a limpar */ }
}

/* -----------------------------------------------------------------------------
   CPF
   ----------------------------------------------------------------------------- */
export function cpfValido(cpf: string | null | undefined): boolean {
  const limpo = (cpf ?? '').replace(/\D/g, '');
  if (limpo.length !== 11 || /^(\d)\1{10}$/.test(limpo)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(limpo[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(limpo[t])) return false;
  }
  return true;
}

export function mascaraCPF(v: string): string {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}
