/* =============================================================================
   ESTADO DO LEAD + UTMs
   -----------------------------------------------------------------------------
   Tudo aqui só deve ser chamado do lado do cliente (dentro de useEffect ou de
   um manipulador de evento) — nunca no corpo de um Server Component, já que
   sessionStorage/window não existem no servidor.
   ============================================================================= */

import { CONFIG } from './config';

export interface Lead {
  nome?: string;
  email?: string;
  cidade?: string;
  assinou?: boolean;
  valor?: number;
  cpf?: string | null;
  contribuiu?: boolean;
  transacaoId?: string;
  comentou?: boolean;
  /* Coletados na etapa de checkout (etapa 4b). */
  whatsapp?: string;
  anonimo?: boolean;
  orderBump?: boolean;
}

const CHAVE_LEAD = 'funil_lead';
const CHAVE_UTMS = 'funil_utms';

function lerJSON<T>(chave: string, padrao: T): T {
  if (typeof window === 'undefined') return padrao;
  try {
    const bruto = window.sessionStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarJSON(chave: string, valor: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sessionStorage bloqueado (modo privado, cookies desativados) — segue sem persistir */
  }
}

export const Estado = {
  lead(): Lead {
    return lerJSON<Lead>(CHAVE_LEAD, {});
  },

  salvar(patch: Partial<Lead>): Lead {
    const atual = { ...this.lead(), ...patch };
    gravarJSON(CHAVE_LEAD, atual);
    return atual;
  },

  /** Captura as UTMs da URL atual e funde com as já guardadas na sessão. */
  capturarUTMs(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    const guardadas = lerJSON<Record<string, string>>(CHAVE_UTMS, {});
    for (const chave of CONFIG.utmsPreservadas) {
      const valor = params.get(chave);
      if (valor) guardadas[chave] = valor;
    }
    if (!guardadas.referrer_inicial && document.referrer &&
        !document.referrer.includes(window.location.hostname)) {
      guardadas.referrer_inicial = document.referrer;
    }
    gravarJSON(CHAVE_UTMS, guardadas);
    return guardadas;
  },

  utms(): Record<string, string> {
    return lerJSON<Record<string, string>>(CHAVE_UTMS, {});
  },

  primeiroNome(): string {
    return (this.lead().nome ?? '').trim().split(/\s+/)[0] ?? '';
  }
};

export const fmtMoeda = (n: number): string =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export const fmt = (n: number): string => Number(n || 0).toLocaleString('pt-BR');
