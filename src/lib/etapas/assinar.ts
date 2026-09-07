import { CONFIG } from '../config';
import { Estado } from '../estado';
import { Track } from '../track';
import { ir } from '../navegacao';
import { qa, aoClicar, toast } from '../dom';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function iniciarAssinar(): () => void {
  Track.ev('view_form');

  const remocoes: (() => void)[] = [];

  // Configurar o botão de Fechar (X) para voltar à página inicial
  const botoesFechar = document.querySelectorAll('button[aria-label="Descartar"], button[aria-label="Close"], button[aria-label="Fechar"], [data-qa="close-button"]');
  botoesFechar.forEach((btn) => {
    remocoes.push(aoClicar(btn as HTMLElement, () => ir('peticao')));
  });

  /* O formulário do Change.org existe em duas variantes: campos separados
     "Nome" + "Sobrenome", ou um único campo combinado "Nome completo". */
  const campo = (n: string) => document.querySelector<HTMLInputElement>(`[name="${n}"]`);
  const nome = campo('firstName');
  const sobre = campo('lastName');
  const email = campo('email');
  const cidade = campo('city');
  const nomeUnico = !sobre;

  const lead = Estado.lead();
  if (lead.nome && nome) nome.value = nomeUnico ? lead.nome : lead.nome.split(' ')[0]!;
  if (lead.nome && sobre) sobre.value = lead.nome.split(' ').slice(1).join(' ');
  if (lead.email && email) email.value = lead.email;

  function marcarErro(el: HTMLElement | null, erro: boolean) {
    if (!el) return;
    const target = (el.parentElement as HTMLElement) || el;
    target.style.borderColor = erro ? '#d40225' : '';
    target.style.boxShadow = erro ? '0 0 0 3px rgba(212, 2, 37, 0.2)' : '';
    el.style.outline = 'none';
  }

  async function enviar() {
    const e = (email?.value ?? '').trim();
    const n = (nome?.value ?? '').trim();
    const s = (sobre?.value ?? '').trim();
    const emailValido = emailOk(e);
    const nomeValido = nomeUnico ? n.trim().split(/\s+/).length >= 2 : !!(n && s);

    marcarErro(nome, !nomeValido && (nomeUnico || !n));
    marcarErro(sobre, !nomeValido && !nomeUnico && !s);
    marcarErro(email, !emailValido);

    if (!nomeValido || !emailValido) {
      toast(!emailValido && e ? 'E-mail inválido.' : nomeUnico ? 'Informe nome e sobrenome.' : 'Preencha nome, sobrenome e e-mail.');
      (!nomeValido ? nome : email)?.focus();
      return;
    }

    const dados = {
      nome: (nomeUnico ? n : `${n} ${s}`).trim(),
      email: e,
      cidade: (cidade?.value ?? '').trim(),
      assinou: true
    };

    try {
      if (!CONFIG.api.modoSimulado) {
        const r = await fetch('/api/assinaturas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...dados, campanha: CONFIG.campanha.id, utms: Estado.utms() })
        });
        if (!r.ok) throw new Error('falha');
      }
      Estado.salvar(dados);
      Track.ev('assinatura', { email: dados.email });
      ir('turbinar');
    } catch {
      toast('Não foi possível registrar. Tente novamente.');
    }
  }

  // Esconde o campo/bloco de cidade e estado travado
  const cidadeInput = campo('city');
  if (cidadeInput) {
    const containerCidade = cidadeInput.closest('div[class*="flex"], div[class*="border"], div[role="presentation"]') as HTMLElement || cidadeInput.parentElement;
    if (containerCidade) containerCidade.style.display = 'none';
  }
  document.querySelectorAll<HTMLElement>('[data-qa*="city"], [data-testid*="city"]').forEach((el) => {
    el.style.display = 'none';
  });

  // Substitui Gabriel Ferreira por Lucas Silva no ticker superior
  document.querySelectorAll<HTMLElement>('.funil-etapa-assinar span, .funil-etapa-assinar div').forEach((el) => {
    if (el.children.length === 0 && /Gabriel\s+Ferreira/i.test(el.textContent ?? '')) {
      el.textContent = el.textContent!.replace(/Gabriel\s+Ferreira/gi, 'Lucas Silva');
    }
  });

  // Ticker superior deslizando suavemente para o lado
  const topTicker = document.querySelector<HTMLElement>('.funil-etapa-assinar .overflow-x-hidden, .funil-etapa-assinar .snap-x');
  if (topTicker) {
    topTicker.style.overflowX = 'auto';
    topTicker.style.scrollBehavior = 'auto';
    topTicker.style.scrollbarWidth = 'none';

    let scrollPos = topTicker.scrollLeft;
    const timerTopScroll = setInterval(() => {
      if (!topTicker) return;
      scrollPos += 0.8;
      if (scrollPos >= topTicker.scrollWidth - topTicker.clientWidth) {
        scrollPos = 0;
      }
      topTicker.scrollLeft = scrollPos;
    }, 25);

    remocoes.push(() => clearInterval(timerTopScroll));
  }

  // Torna os botões de rádio (Sim/Não) e checkbox 100% clicáveis e responsivos
  const optInRadio = document.querySelector<HTMLElement>('[data-qa="signform-gdprConsent-optIn-radio"]');
  const optOutRadio = document.querySelector<HTMLElement>('[data-qa="signform-gdprConsent-optOut-radio"]');
  const notPublicCheckbox = document.querySelector<HTMLElement>('[data-qa="signform-notPublic-checkbox"]');

  const inputOptIn = optInRadio?.querySelector<HTMLInputElement>('input[type="radio"]') || document.querySelector<HTMLInputElement>('input[value="true"]');
  const inputOptOut = optOutRadio?.querySelector<HTMLInputElement>('input[type="radio"]') || document.querySelector<HTMLInputElement>('input[value="false"]');
  const inputNotPublic = notPublicCheckbox?.querySelector<HTMLInputElement>('input[type="checkbox"]') || document.querySelector<HTMLInputElement>('input[name="notPublic"]');

  function atualizarRadiosVisual(sim: boolean) {
    if (inputOptIn) inputOptIn.checked = sim;
    if (inputOptOut) inputOptOut.checked = !sim;

    if (optInRadio) {
      optInRadio.setAttribute('data-selected', sim ? 'true' : 'false');
      optInRadio.setAttribute('selected', sim ? 'true' : 'false');
      const dot = optInRadio.querySelector('.after\\:scale-0, [class*="after:scale"]');
      if (dot) (dot as HTMLElement).style.transform = sim ? 'scale(1)' : 'scale(0)';
      if (dot) (dot as HTMLElement).style.opacity = sim ? '1' : '0';
    }
    if (optOutRadio) {
      optOutRadio.setAttribute('data-selected', sim ? 'false' : 'true');
      optOutRadio.setAttribute('selected', sim ? 'false' : 'true');
      const dot = optOutRadio.querySelector('.after\\:scale-0, [class*="after:scale"]');
      if (dot) (dot as HTMLElement).style.transform = sim ? 'scale(0)' : 'scale(1)';
      if (dot) (dot as HTMLElement).style.opacity = sim ? '0' : '1';
    }
  }

  if (optInRadio) remocoes.push(aoClicar(optInRadio, () => atualizarRadiosVisual(true)));
  if (optOutRadio) remocoes.push(aoClicar(optOutRadio, () => atualizarRadiosVisual(false)));

  if (notPublicCheckbox) {
    remocoes.push(aoClicar(notPublicCheckbox, (e) => {
      e.preventDefault();
      if (inputNotPublic) {
        inputNotPublic.checked = !inputNotPublic.checked;
        const checked = inputNotPublic.checked;
        if (checked) {
          notPublicCheckbox.setAttribute('data-selected', 'true');
          notPublicCheckbox.setAttribute('selected', 'true');
        } else {
          notPublicCheckbox.removeAttribute('data-selected');
          notPublicCheckbox.removeAttribute('selected');
        }
        const checkIcon = notPublicCheckbox.querySelector('svg');
        if (checkIcon) {
          checkIcon.style.opacity = checked ? '1' : '0';
          checkIcon.style.transform = checked ? 'scale(1)' : 'scale(0.5)';
        }
      }
    }));
  }

  const submitBtn = qa('signform-submit-button') ?? document.querySelector('button[type="submit"]');
  if (submitBtn) {
    remocoes.push(aoClicar(submitBtn, enviar));
  }

  // enter em qualquer campo envia
  const onKeydown = (ev: KeyboardEvent) => { if (ev.key === 'Enter') { ev.preventDefault(); void enviar(); } };
  [nome, sobre, email].forEach((el) => el?.addEventListener('keydown', onKeydown));

  return () => {
    remocoes.forEach((f) => f());
    [nome, sobre, email].forEach((el) => el?.removeEventListener('keydown', onKeydown));
  };
}

