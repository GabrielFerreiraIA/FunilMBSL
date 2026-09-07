import { CONFIG } from '../config';
import { DADOS } from '../dados';
import { fmtMoeda } from '../estado';

/** Quantas pessoas o valor escolhido alcança — proporcional, arredondado. */
export function alcanceDe(valor: number): number {
  const { pessoasPorReal, arredondarPara } = CONFIG.contribuicao;
  const bruto = Math.max(0, Number(valor) || 0) * pessoasPorReal;
  if (bruto <= 0) return 0;
  return Math.max(arredondarPara, Math.round(bruto / arredondarPara) * arredondarPara);
}

/** Animação fluida vertical do feed de doadores ("turbinou com R$ X"), mostrando sempre 2 de cada vez */
export function animarFeedDoadores(): () => void {
  const container = document.getElementById('hero-feed-accessible-list') ||
                    document.querySelector<HTMLElement>('#hero-feed-accessible-list') ||
                    document.querySelector<HTMLElement>('.max-h-20');

  if (!container) return () => {};

  container.style.maxHeight = '80px';
  container.style.height = '80px';
  container.style.overflowY = 'hidden';
  container.style.overflowX = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '8px';

  // Se o container tem poucos itens no HTML original, complementamos com DADOS.doadores
  const itensAtuais = container.querySelectorAll('span');
  if (itensAtuais.length > 0 && itensAtuais.length < 8) {
    const itemModelo = itensAtuais[0].cloneNode(true) as HTMLElement;
    DADOS.doadores.slice(itensAtuais.length).forEach(([nome, valor]) => {
      const clone = itemModelo.cloneNode(true) as HTMLElement;
      const spansTexto = clone.querySelectorAll('span');
      if (spansTexto.length >= 2) {
        spansTexto[0].textContent = nome;
        spansTexto[1].textContent = ` turbinou com ${fmtMoeda(valor)}`;
      } else if (spansTexto.length === 1) {
        spansTexto[0].textContent = `${nome} turbinou com ${fmtMoeda(valor)}`;
      }
      const img = clone.querySelector('img');
      if (img) img.alt = `${nome} turbinou com ${fmtMoeda(valor)}`;
      container.appendChild(clone);
    });
  }

  // Duplica os filhos para criar a rolagem contínua (loop infinito sem salto visual)
  if (!container.getAttribute('data-feed-duplicado')) {
    container.setAttribute('data-feed-duplicado', 'true');
    const htmlOriginal = container.innerHTML;
    container.innerHTML = htmlOriginal + htmlOriginal;
  }

  let scrollPos = 0;
  const timer = setInterval(() => {
    if (!container) return;
    scrollPos += 0.6; // velocidade fluida e suave
    const meiaAltura = container.scrollHeight / 2;
    if (meiaAltura > 0 && scrollPos >= meiaAltura) {
      scrollPos = 0;
    }
    container.scrollTop = scrollPos;
  }, 25);

  return () => clearInterval(timer);
}

