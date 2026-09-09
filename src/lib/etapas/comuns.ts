import { CONFIG } from '../config';
import { DADOS } from '../dados';
import { Estado, fmtMoeda } from '../estado';

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
  const primeiroItem = itensAtuais[0];
  if (primeiroItem && itensAtuais.length < 8) {
    const itemModelo = primeiroItem.cloneNode(true) as HTMLElement;
    DADOS.doadores.slice(itensAtuais.length).forEach(([nome, valor]) => {
      const clone = itemModelo.cloneNode(true) as HTMLElement;
      const spansTexto = clone.querySelectorAll('span');
      const [spanNome, spanValor] = spansTexto;
      if (spanNome && spanValor) {
        spanNome.textContent = nome;
        spanValor.textContent = ` turbinou com ${fmtMoeda(valor)}`;
      } else if (spanNome) {
        spanNome.textContent = `${nome} turbinou com ${fmtMoeda(valor)}`;
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


/* O capture foi tirado da sessão de um signatário real, então os títulos vêm
   com o primeiro nome dele escrito no meio da frase ("Gabriel, seu apoio ainda
   pode ser maior!"). Troca pelo nome que a própria pessoa preencheu na etapa de
   assinatura. Sem nome guardado, remove o vocativo — saudar o visitante pelo
   nome de um estranho é pior do que não saudar. */
const NOME_DO_CAPTURE = /Gabriel(\s+Ferreira)?/g;

export function personalizarSaudacao(): void {
  const nome = Estado.primeiroNome();

  document.querySelectorAll<HTMLElement>('h1, h2').forEach((el) => {
    // textContent só é seguro de reescrever em nó folha: num título com
    // <strong> ou <span> dentro, atribuir texto apagaria a marcação.
    if (el.children.length > 0) return;

    const txt = el.textContent ?? '';
    if (!txt.includes('Gabriel')) return;

    if (nome) {
      el.textContent = txt.replace(NOME_DO_CAPTURE, nome);
      return;
    }

    const semVocativo = txt
      .replace(/^Gabriel(\s+Ferreira)?,\s*/, '')      // "Gabriel, seu apoio…"
      .replace(/,\s*Gabriel(\s+Ferreira)?\b/g, '');   // "Incrível, Gabriel! …"
    el.textContent = semVocativo.charAt(0).toUpperCase() + semVocativo.slice(1);
  });
}
