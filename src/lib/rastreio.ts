/* =============================================================================
   RASTREIO — PERSISTÊNCIA DOS EVENTOS
   -----------------------------------------------------------------------------
   O Track.ev() espalha os eventos para os pixels (GA4, Meta, TikTok, UTMify),
   mas nada disso fica sendo nosso. Este módulo é o segundo destino: manda cada
   evento para /api/eventos, que grava em `dados/eventos.jsonl` dentro do
   próprio projeto — sem banco, para o MVP.

   Só cliente. A navegação entre etapas é full page reload (ver navegacao.ts),
   então tudo aqui gira em torno de uma regra: o evento precisa sair ANTES de a
   página morrer. Daí o sendBeacon no pagehide, que é o único envio que o
   navegador garante durante o unload.
   ============================================================================= */

import { CONFIG } from './config';
import { Estado } from './estado';

export type TipoEvento = 'nomeado' | 'clique' | 'pageview';

interface EventoRastreado {
  ts: string;
  visitante_id: string;
  sessao_id: string;
  tipo: TipoEvento;
  evento: string;
  etapa: string | null;
  url: string;
  referrer: string | null;
  nome: string | null;
  email: string | null;
  utms: Record<string, string>;
  dados: Record<string, unknown>;
}

const ENDPOINT = '/api/eventos';
const CHAVE_VISITANTE = 'funil_visitante_id';
const CHAVE_SESSAO = 'funil_sessao_id';

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* randomUUID exige contexto seguro — cai no fallback */ }
  return `v${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Lê um id do storage, criando na primeira visita. Storage bloqueado (aba
    anônima, cookies desativados) não pode derrubar o funil: devolve um id
    efêmero e segue. */
function idGuardado(tipo: 'local' | 'sessao', chave: string): string {
  try {
    const store = tipo === 'local' ? window.localStorage : window.sessionStorage;
    const atual = store.getItem(chave);
    if (atual) return atual;
    const novo = uuid();
    store.setItem(chave, novo);
    return novo;
  } catch {
    return 'efemero-' + uuid();
  }
}

/* A etapa já está no DOM: FunilPagina renderiza data-etapa no container. Ler
   de lá evita manter um segundo estado de "onde estamos" em paralelo ao do
   track.ts, que sairia de sincronia na primeira distração. */
function etapaAtual(): string | null {
  return document.querySelector('[data-etapa]')?.getAttribute('data-etapa') ?? null;
}

let fila: EventoRastreado[] = [];
let timer: number | null = null;

function enviar(): void {
  if (fila.length === 0) return;
  const lote = fila;
  fila = [];
  const corpo = JSON.stringify({ eventos: lote });

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([corpo], { type: 'application/json' }));
      if (ok) return;
    }
  } catch { /* beacon recusado (payload grande, CSP) — tenta o fetch abaixo */ }

  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true
    }).catch(() => { /* telemetria não retenta: perder um evento é melhor que travar a jornada */ });
  } catch { /* offline */ }
}

/** Agrupa rajadas (um clique costuma disparar clique + evento nomeado juntos)
    num POST só, sem segurar nada por tempo demais. */
function agendar(): void {
  if (timer !== null) return;
  timer = window.setTimeout(() => { timer = null; enviar(); }, 400);
}

export function registrar(evento: string, tipo: TipoEvento, dados: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || !CONFIG.tracking.rastreio.ativo) return;

  const lead = Estado.lead();
  fila.push({
    ts: new Date().toISOString(),
    visitante_id: idGuardado('local', CHAVE_VISITANTE),
    sessao_id: idGuardado('sessao', CHAVE_SESSAO),
    tipo,
    evento,
    etapa: etapaAtual(),
    url: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    nome: lead.nome ?? null,
    email: lead.email ?? null,
    utms: Estado.utms(),
    dados
  });
  agendar();
}

/* Sobe o rastreio da etapa: pageview, todos os cliques e a descarga da fila.
   Devolve a função de limpeza para o useEffect, no mesmo contrato das outras
   funções do funil. */
export function iniciarRastreio(): () => void {
  if (typeof window === 'undefined' || !CONFIG.tracking.rastreio.ativo) return () => {};

  registrar('pageview', 'pageview', { titulo: document.title });

  const alvoDoClique = (alvo: EventTarget | null): HTMLElement | null => {
    if (!(alvo instanceof Element)) return null;
    return alvo.closest<HTMLElement>('button, a, [role="button"], input[type="submit"], [data-qa]');
  };

  const aoClicarQualquer = (ev: MouseEvent) => {
    const el = alvoDoClique(ev.target);
    if (!el) return;
    registrar('clique', 'clique', {
      qa: el.getAttribute('data-qa') ?? el.getAttribute('data-testid') ?? null,
      rotulo: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80) || null,
      tag: el.tagName.toLowerCase(),
      href: el.getAttribute('href') ?? null,
      id: el.id || null
    });
  };

  /* Capture no document, e não bubbling: os handlers do próprio funil
     (dom.ts → aoClicar) chamam stopPropagation, então um listener de bubbling
     jamais veria os cliques nos botões que mais importam. O document é o
     primeiro nó da fase de captura, então aqui chega tudo. */
  document.addEventListener('click', aoClicarQualquer, true);

  const descarregar = () => enviar();
  const aoEsconder = () => { if (document.visibilityState === 'hidden') enviar(); };

  window.addEventListener('pagehide', descarregar);
  document.addEventListener('visibilitychange', aoEsconder);

  return () => {
    document.removeEventListener('click', aoClicarQualquer, true);
    window.removeEventListener('pagehide', descarregar);
    document.removeEventListener('visibilitychange', aoEsconder);
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    enviar();
  };
}
