import { CONFIG } from '../config';
import { Track } from '../track';
import { ir } from '../navegacao';
import { qaAll, aoClicar } from '../dom';

/** Devolve a função de limpeza, chamada quando o componente desmonta. */
export function iniciarPeticao(): () => void {
  Track.ev('view_peticao');

  const botoes = qaAll('mobile-sign-button');
  const remocoes: (() => void)[] = botoes.map((b, i) =>
    aoClicar(b, () => {
      Track.ev('click_assinar', { posicao: i === 0 ? 'topo' : 'meio' });
      ir('assinar');
    })
  );

  // 1. Criar o Botão Fixo na Parte de Baixo (Sticky CTA Bar)
  const bar = document.createElement('div');
  bar.className = 'funil-sticky-bar';

  const btn = document.createElement('button');
  btn.className = 'funil-sticky-btn';
  btn.setAttribute('type', 'button');
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
    Assinar abaixo-assinado
  `;

  bar.appendChild(btn);
  document.body.appendChild(bar);

  remocoes.push(
    aoClicar(btn, () => {
      Track.ev('click_assinar', { posicao: 'sticky_bottom' });
      ir('assinar');
    })
  );

  const aoRolar = () => {
    if (window.scrollY > 120) {
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }
  };

  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

  remocoes.push(() => {
    window.removeEventListener('scroll', aoRolar);
    bar.remove();
  });

  // O VSL (quando ligado em config.tracking.vturb) entra no topo do <main>
  if (CONFIG.tracking.vturb.ativo) {
    const ancora = (document.querySelector('main') ?? document.body) as HTMLElement;
    Track.vsl(ancora, botoes);
  }

  return () => remocoes.forEach((f) => f());
}

