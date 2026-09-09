/* =============================================================================
   UTILITÁRIOS DE DOM
   -----------------------------------------------------------------------------
   O conteúdo capturado (content/*.html) é injetado via dangerouslySetInnerHTML,
   então continuamos ligando comportamento em cima dele com querySelector +
   data-qa, exatamente como antes — só que agora em TypeScript e chamado a
   partir de um useEffect de cada página.
   ============================================================================= */

export const qa = (nome: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-qa="${nome}"]`);

export const qaAll = (nome: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-qa="${nome}"]`));

/** Intercepta o clique num elemento (inclusive <div> sem href). Devolve uma função de remoção. */
export function aoClicar(el: HTMLElement | null, fn: (ev: MouseEvent) => void): () => void {
  if (!el) return () => {};
  el.style.cursor = 'pointer';
  const handler = (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); fn(ev); };
  el.addEventListener('click', handler, true);
  return () => el.removeEventListener('click', handler, true);
}

let toastEl: HTMLDivElement | null = null;

export function toast(msg: string): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'funil-toast';
    toastEl.style.cssText =
      'position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);' +
      'z-index:99999;background:#3a3e49;color:#fff;padding:12px 22px;border-radius:999px;' +
      'font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);' +
      'opacity:0;transition:.2s;pointer-events:none;white-space:nowrap';
    document.body.appendChild(toastEl);
  }
  const t = toastEl;
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translate(-50%,0)'; });
  window.clearTimeout((t as HTMLDivElement & { _t?: number })._t);
  (t as HTMLDivElement & { _t?: number })._t = window.setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translate(-50%,16px)';
  }, 2400);
}

export async function copiar(txt: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(txt); return; } catch { /* cai no fallback abaixo */ }
  }
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
}

/** As páginas capturadas têm dezenas de links externos — neutraliza-os. */
export function neutralizarExternos(): void {
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const h = a.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(h) && !h.includes(window.location.hostname)) {
      a.setAttribute('data-href-original', h);
      a.setAttribute('href', 'javascript:void(0)');
      a.removeAttribute('target');
    }
  });
}
