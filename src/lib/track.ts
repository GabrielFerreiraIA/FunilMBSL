/* =============================================================================
   TRACKING
   -----------------------------------------------------------------------------
   Um ponto de entrada — Track.ev('nome', {dados}) — que espalha para
   dataLayer (GTM), gtag (GA4), fbq (Meta), ttq (TikTok), UTMify e um
   CustomEvent no document, para qualquer script externo escutar.

   Chame só do lado do cliente.
   ============================================================================= */

import { CONFIG } from './config';
import { Estado } from './estado';

export type EventoNome =
  | 'view_peticao' | 'click_assinar' | 'view_form' | 'assinatura'
  | 'view_upsell' | 'aceite_upsell' | 'recusa_upsell'
  | 'view_pagamento' | 'valor_selecionado' | 'view_checkout' | 'toggle_orderbump'
  | 'pix_gerado' | 'view_pix' | 'pix_copiado' | 'pagamento_ok'
  | 'view_share' | 'compartilhou' | 'scroll' | 'video_play' | 'view_obrigado';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (nome: string, dados: Record<string, unknown>) => void };
    utmify?: (evento: string, dados: Record<string, unknown>) => void;
    FUNIL_DEBUG?: boolean;
  }
}

const MAPA: Partial<Record<EventoNome, { meta: string | null; ga4: string | null }>> = {
  view_peticao: { meta: 'ViewContent', ga4: 'view_item' },
  click_assinar: { meta: 'Lead', ga4: 'select_promotion' },
  view_form: { meta: 'InitiateCheckout', ga4: 'begin_checkout' },
  assinatura: { meta: 'CompleteRegistration', ga4: 'sign_up' },
  view_upsell: { meta: 'ViewContent', ga4: 'view_promotion' },
  aceite_upsell: { meta: 'AddToCart', ga4: 'add_to_cart' },
  recusa_upsell: { meta: null, ga4: 'upsell_declined' },
  view_pagamento: { meta: 'InitiateCheckout', ga4: 'begin_checkout' },
  valor_selecionado: { meta: 'AddPaymentInfo', ga4: 'add_payment_info' },
  // Sem evento de Meta: view_pagamento já dispara o InitiateCheckout desta
  // jornada — repetir aqui infla o funil de otimização do anúncio.
  view_checkout: { meta: null, ga4: 'view_checkout' },
  toggle_orderbump: { meta: null, ga4: 'toggle_orderbump' },
  pix_gerado: { meta: 'AddPaymentInfo', ga4: 'generate_pix' },
  // A tela do Pix é onde a intenção de pagar fica explícita — vale como
  // checkout iniciado no Meta, sem duplicar o Purchase, que só sai no
  // pagamento_ok.
  view_pix: { meta: null, ga4: 'view_pix' },
  pix_copiado: { meta: null, ga4: 'copy_pix' },
  pagamento_ok: { meta: 'Purchase', ga4: 'purchase' },
  view_share: { meta: null, ga4: 'view_share' },
  compartilhou: { meta: null, ga4: 'share' },
  scroll: { meta: null, ga4: 'scroll' }
};

let etapaAtual = 'peticao';

export const Track = {
  /** Cada página chama isto uma vez ao montar, para os eventos saberem de onde vieram. */
  setEtapa(etapa: string): void {
    etapaAtual = etapa;
  },

  ev(nome: EventoNome, dados: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer ?? [];

    const payload: Record<string, unknown> = {
      campanha_id: CONFIG.campanha.id,
      etapa: etapaAtual,
      ...Estado.utms(),
      ...dados
    };
    const mapa = MAPA[nome];

    window.dataLayer.push({ event: 'funil_' + nome, ...payload });

    if (typeof window.gtag === 'function' && mapa?.ga4) {
      try { window.gtag('event', mapa.ga4, payload); } catch { /* pixel indisponível */ }
    }
    if (typeof window.fbq === 'function' && mapa?.meta) {
      try {
        const md: Record<string, unknown> = { content_name: payload.campanha_id };
        if (payload.valor) { md.value = payload.valor; md.currency = 'BRL'; }
        window.fbq('track', mapa.meta, md);
      } catch { /* pixel indisponível */ }
    }
    if (window.ttq && typeof window.ttq.track === 'function' && mapa?.meta) {
      try { window.ttq.track(mapa.meta, { value: payload.valor ?? 0, currency: 'BRL' }); } catch { /* pixel indisponível */ }
    }
    if (nome === 'pagamento_ok' && CONFIG.tracking.utmify.ativo && CONFIG.tracking.utmify.enviarConversao) {
      try {
        if (typeof window.utmify === 'function') {
          window.utmify('purchase', {
            value: payload.valor, currency: 'BRL', transaction_id: payload.transacao_id
          });
        }
        window.dataLayer.push({
          event: 'purchase', value: payload.valor, currency: 'BRL', transaction_id: payload.transacao_id
        });
      } catch { /* pixel indisponível */ }
    }
    try {
      document.dispatchEvent(new CustomEvent('funil:' + nome, { detail: payload }));
    } catch { /* CustomEvent indisponível em navegadores muito antigos */ }

    if (window.FUNIL_DEBUG) console.log('[funil]', nome, payload);
  },

  /** Marcos de rolagem — devolve uma função de limpeza para o useEffect. */
  scroll(): () => void {
    const marcos = [...CONFIG.tracking.scrollDepth].sort((a, b) => a - b);
    const feitos: Record<number, boolean> = {};

    const tick = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      if (total <= 0) return;
      const pct = Math.round((h.scrollTop / total) * 100);
      for (const m of marcos) {
        if (pct >= m && !feitos[m]) { feitos[m] = true; Track.ev('scroll', { profundidade: m }); }
      }
    };
    window.addEventListener('scroll', tick, { passive: true });
    return () => window.removeEventListener('scroll', tick);
  },

  /** VSL: injeta o player VTurb e, se houver pitch delay, segura os CTAs. */
  vsl(container: HTMLElement | null, ctas: (HTMLElement | null)[]): void {
    const v = CONFIG.tracking.vturb;
    if (!v.ativo || !v.playerId || !container) { container?.remove(); return; }

    const host = document.createElement('div');
    host.id = 'vid_' + v.playerId;
    container.appendChild(host);

    const s = document.createElement('script');
    s.src = `https://scripts.converteai.net/${v.contaId}/players/${v.playerId}/player.js`;
    s.async = true;
    document.head.appendChild(s);
    Track.ev('video_play', { player: v.playerId });

    if (v.liberarCtaAos > 0) {
      ctas.forEach((c) => { if (c) c.style.visibility = 'hidden'; });
      setTimeout(() => { ctas.forEach((c) => { if (c) c.style.visibility = ''; }); }, v.liberarCtaAos * 1000);
    }
  }
};
