/* =============================================================================
   NOTIFICAÇÕES AO VIVO ("Fulano acabou de assinar")
   -----------------------------------------------------------------------------
   Recurso novo — não existe no capture original — desenhado com as mesmas
   cores e fonte do design original para não destoar. Ritmo deliberadamente
   lento: cadência rápida denuncia que é script.
   ============================================================================= */

import { CONFIG } from './config';
import { DADOS } from './dados';
import { fmtMoeda } from './estado';

interface ItemNotificacao {
  nome: string;
  texto: string;
  meta?: string;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let node: HTMLDivElement | null = null;
let cssInjetado = false;

function injetarCSS(): void {
  if (cssInjetado) return;
  cssInjetado = true;
  const css = `
    .funil-notif{position:fixed;left:14px;bottom:18px;z-index:9998;display:flex;
      align-items:center;gap:10px;max-width:min(320px,calc(100vw - 28px));
      padding:10px 16px 10px 10px;background:#fff;border:1px solid #dde0e9;
      border-radius:999px;box-shadow:0 10px 25px -5px rgba(0,0,0,.18);
      font-family:"Commissioner",ui-sans-serif,system-ui,sans-serif;
      transform:translateX(-130%);opacity:0;
      transition:transform .9s cubic-bezier(.19,1,.22,1),opacity .6s ease}
    .funil-notif.aberto{transform:translateX(0);opacity:1}
    .funil-notif__av{width:34px;height:34px;flex:none;border-radius:999px;color:#fff;
      display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
    .funil-notif__txt{font-size:13px;line-height:1.35;color:#2d2f37;min-width:0}
    .funil-notif__nome{font-weight:600;display:block;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis}
    .funil-notif__meta{color:#3a3e49cc;font-size:12px}
    @media (prefers-reduced-motion:reduce){.funil-notif{transition:opacity .4s}}
  `;
  const style = document.createElement('style');
  style.id = 'funil-notif-css';
  style.textContent = css;
  document.head.appendChild(style);
}

const PALETA = ['#f34e49', '#4771ff', '#0f8110', '#9d470f', '#0d4dfb', '#bc1e19', '#6b21a8', '#0e7490'];

function corDe(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length]!;
}

function iniciaisDe(nome: string): string {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase();
}

function mostrar(item: ItemNotificacao, duracao: number): void {
  node?.remove();

  const av = document.createElement('span');
  av.className = 'funil-notif__av';
  av.style.background = corDe(item.nome);
  av.textContent = iniciaisDe(item.nome);

  const nomeEl = document.createElement('span');
  nomeEl.className = 'funil-notif__nome';
  nomeEl.textContent = item.nome;

  const metaEl = document.createElement('span');
  metaEl.className = 'funil-notif__meta';
  metaEl.textContent = item.texto + (item.meta ? ` · ${item.meta}` : '');

  const txt = document.createElement('span');
  txt.className = 'funil-notif__txt';
  txt.append(nomeEl, metaEl);

  const n = document.createElement('div');
  n.className = 'funil-notif';
  n.setAttribute('role', 'status');
  n.setAttribute('aria-live', 'polite');
  n.append(av, txt);

  document.body.appendChild(n);
  node = n;
  requestAnimationFrame(() => n.classList.add('aberto'));

  window.setTimeout(() => {
    n.classList.remove('aberto');
    window.setTimeout(() => { n.remove(); if (node === n) node = null; }, 900);
  }, duracao);
}

/** Fila única, embaralhada, misturando assinaturas e contribuições. */
function filaDeNotificacoes(): ItemNotificacao[] {
  const fila: ItemNotificacao[] = [
    ...DADOS.assinantes.map(([nome, tempo]) => ({ nome, texto: 'acabou de assinar', meta: `há ${tempo}` })),
    ...DADOS.doadores.map(([nome, valor]) => ({ nome, texto: `contribuiu com ${fmtMoeda(valor)}` }))
  ];
  for (let i = fila.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fila[i], fila[j]] = [fila[j]!, fila[i]!];
  }
  return fila;
}

export function iniciarNotificacoes(): void {
  const cfg = CONFIG.notificacoes;
  if (!cfg.ativo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  injetarCSS();
  pararNotificacoes();

  const fila = filaDeNotificacoes();
  if (!fila.length) return;
  let i = Math.floor(Math.random() * fila.length);

  function proxima(): void {
    const item = fila[i % fila.length]!;
    i++;
    mostrar(item, cfg.duracao || 6500);
    const espera = cfg.intervaloMin + Math.random() * (cfg.intervaloMax - cfg.intervaloMin);
    timer = setTimeout(proxima, espera);
  }
  timer = setTimeout(proxima, cfg.primeiroApos || 6000);
}

export function pararNotificacoes(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (node) { node.remove(); node = null; }
}
