/* Esta etapa só escolhe o valor da contribuição. Gerar o Pix, cobrar e
   confirmar o pagamento é trabalho da etapa seguinte (checkout.ts). */
import { CONFIG } from '../config';
import { Estado, fmt, fmtMoeda } from '../estado';
import { Track } from '../track';
import { ir, exigirAssinatura } from '../navegacao';
import { qa, qaAll, aoClicar, toast } from '../dom';
import { alcanceDe } from './comuns';

export function iniciarPagamento(): () => void {
  if (!exigirAssinatura()) return () => {};

  const lead = Estado.lead();
  let valor = Number(lead.valor) || CONFIG.contribuicao.valorPadrao;

  const btns = qaAll('suggested-amount-button');
  const custom = qa('custom-amount-input') as HTMLInputElement | null;
  const submit = qa('promote-submit-button');

  Track.ev('view_pagamento', { valor_inicial: valor });

  /* -- seleção visual --
     O capture já traz um botão selecionado. Em vez de inventar um estilo,
     lemos as classes que o próprio design system usa para "selecionado" e
     "normal" e apenas alternamos entre elas — o realce fica idêntico. */
  function valorDoBotao(b: HTMLElement): number | null {
    const m = (b.innerText || '').replace(/\./g, '').match(/R\$\s*(\d+)/);
    return m ? Number(m[1]) : null;
  }

  let clsSel: string | null = null;
  let clsNorm: string | null = null;
  btns.forEach((b) => {
    const c = b.className || '';
    if (/bg-fill-information-weaker/.test(c)) { if (!clsSel) clsSel = c; }
    else if (!clsNorm) clsNorm = c;
  });
  const usarClasses = !!(clsSel && clsNorm);

  function pintar(sel: number) {
    btns.forEach((b) => {
      const ativo = valorDoBotao(b) === sel;
      if (usarClasses) {
        b.className = ativo ? clsSel! : clsNorm!;
      } else {
        b.style.background = ativo ? '#f0f7ff' : 'transparent';
        b.style.outline = ativo ? '2px solid #4771ff' : 'none';
        b.style.borderColor = ativo ? 'transparent' : '#a5b9ff';
      }
    });
  }

  /* -- impacto proporcional --
     O capture mostra um número fixo ("alcançar mais 4.000 visualizações").
     Aqui ele recalcula a cada valor escolhido, proporcional à contribuição. */
  const caixaImpacto = qa('experiment-impression-calculation');
  const elImpacto = caixaImpacto?.querySelector<HTMLElement>('strong') ?? null;

  function definir(v: number, origem: 'inicial' | 'grade' | 'custom') {
    valor = v;
    if (origem === 'custom') {
      pintar(-1);
    } else {
      pintar(v);
      if (custom) custom.value = ''; // Não preenche o campo 'outros valores' com o valor do botão clicado
    }

    if (custom) {
      custom.placeholder = 'Valor livre'; // O container HTML já possui o prefixo "R$", então usamos apenas "Valor livre"
    }

    if (submit) {
      const ok = v >= CONFIG.contribuicao.valorMinimo && v <= CONFIG.contribuicao.valorMaximo;
      submit.style.opacity = ok ? '' : '.45';
      submit.style.pointerEvents = ok ? '' : 'none';
    }
    if (elImpacto) {
      elImpacto.textContent = fmt(alcanceDe(v));
      if (origem !== 'inicial') {
        elImpacto.style.transition = 'none';
        elImpacto.style.color = '#0f8110';
        requestAnimationFrame(() => {
          elImpacto.style.transition = 'color .5s ease';
          elImpacto.style.color = '';
        });
      }
    }
  }

  const remocoes: (() => void)[] = [];
  btns.forEach((b) => {
    remocoes.push(aoClicar(b, () => {
      const v = valorDoBotao(b);
      if (v) { definir(v, 'grade'); Track.ev('valor_selecionado', { valor: v, tipo: 'grade' }); }
    }));
  });

  const onCustomInput = () => {
    if (!custom) return;
    const n = Number(custom.value.replace(/\D/g, ''));
    definir(n, 'custom');
  };
  custom?.addEventListener('input', onCustomInput);

  definir(valor, 'inicial');

  /* -- Animação do Ticker de doadores (passando para o lado devagar) -- */
  const tickerContainer = document.querySelector<HTMLElement>('[role="list"]') ||
                          document.querySelector<HTMLElement>('.flex.snap-x') ||
                          document.querySelector<HTMLElement>('.overflow-x-hidden');
  if (tickerContainer) {
    tickerContainer.style.overflowX = 'auto';
    tickerContainer.style.scrollBehavior = 'auto';
    tickerContainer.style.scrollbarWidth = 'none';
    tickerContainer.style.setProperty('-webkit-overflow-scrolling', 'touch');

    let scrollPos = tickerContainer.scrollLeft;
    const timerScroll = setInterval(() => {
      if (!tickerContainer) return;
      scrollPos += 0.8;
      if (scrollPos >= tickerContainer.scrollWidth - tickerContainer.clientWidth) {
        scrollPos = 0;
      }
      tickerContainer.scrollLeft = scrollPos;
    }, 25);

    remocoes.push(() => clearInterval(timerScroll));
  }

  /* -- Remove elementos indesejados (imagem 1 e 3) e esconde seções de pagamento inferiores -- */
  const hr = document.querySelector<HTMLElement>('hr[role="separator"]');
  if (hr) {
    hr.style.display = 'none';
    let el = hr.nextElementSibling as HTMLElement | null;
    while (el) {
      el.style.display = 'none';
      el = el.nextElementSibling as HTMLElement | null;
    }
  }

  /* Oculta o checkbox de salvar cartão, o aviso de termos e o link de recusa.
     Atenção ao textContent: ele traz o texto de TODOS os descendentes, então
     o #rootApp inteiro casa com o padrão exatamente como o parágrafo que
     queremos sumir — esconder o container apagava a página toda. O limite de
     texto separa um aviso (centenas de caracteres) de uma seção da página
     (dezenas de milhares); entre os que passam, escondemos o mais externo,
     senão sumiria só o link "Termos de Uso" no meio da frase, deixando o
     resto do aviso na tela. */
  const PADRAO_OCULTAR =
    /Salvar forma de pagamento|Ao finalizar a compra|provedor de pagamento|Termos de Uso|Política de Privacidade|Desculpe|não posso contribuir/i;
  const LIMITE_TEXTO_AVISO = 600;

  const candidatos = Array.from(
    document.querySelectorAll<HTMLElement>('p, div, label, section, a, hr')
  ).filter((el) => {
    const txt = el.textContent ?? '';
    return txt.length <= LIMITE_TEXTO_AVISO && PADRAO_OCULTAR.test(txt);
  });

  candidatos
    .filter((el) => !candidatos.some((outro) => outro !== el && outro.contains(el)))
    .forEach((el) => { el.style.display = 'none'; });

  /* -- Insere o botão de Continuar no Branding abaixo do ticker de pessoas que doaram -- */
  let btnContinuar = document.getElementById('funil-btn-continuar') as HTMLButtonElement | null;
  if (!btnContinuar) {
    const wrapper = document.createElement('div');
    wrapper.id = 'funil-continuar-wrapper';
    wrapper.style.marginTop = '24px';
    wrapper.style.textAlign = 'center';
    wrapper.innerHTML = `
      <button id="funil-btn-continuar" type="button" class="funil-btn-continuar">
        Continuar &rarr;
      </button>
      <div style="font-size: 13px; color: #64748b; margin-top: 10px; font-weight: 500;">
        Pagamento 100% seguro
      </div>
    `;

    if (hr && hr.parentElement) {
      hr.parentElement.insertBefore(wrapper, hr);
    } else {
      const parent = custom?.closest('form') || document.querySelector('main') || document.body;
      parent.appendChild(wrapper);
    }
    btnContinuar = document.getElementById('funil-btn-continuar') as HTMLButtonElement | null;
  }

  if (btnContinuar) {
    remocoes.push(aoClicar(btnContinuar, () => {
      if (!Number.isFinite(valor) || valor < CONFIG.contribuicao.valorMinimo) {
        toast(`As doações são a partir de ${fmtMoedaSimples(CONFIG.contribuicao.valorMinimo)}.`);
        custom?.focus();
        return;
      }
      Estado.salvar({ valor });
      ir('checkout');
    }));
  }

  return () => {
    remocoes.forEach((f) => f());
    custom?.removeEventListener('input', onCustomInput);
  };
}
