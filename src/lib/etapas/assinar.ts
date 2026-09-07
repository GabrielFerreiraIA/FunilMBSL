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
      cidade: '',
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

  // Remotamente esconde por completo o bloco/botão de cidade e estado travado (Barueri, Brasil)
  const ocultarLocalizacao = () => {
    const editLocationBtn = document.querySelector<HTMLElement>('[data-qa="sign-form-profile-edit-link"], button[aria-label*="Barueri"], button[aria-label*="localização"]');
    if (editLocationBtn) {
      editLocationBtn.style.display = 'none';
      let parent = editLocationBtn.parentElement;
      if (parent) {
        parent.style.display = 'none';
        parent.style.margin = '0';
        parent.style.padding = '0';
        if (parent.parentElement && (parent.parentElement.classList.contains('mt-4') || parent.parentElement.classList.contains('mb-2'))) {
          parent.parentElement.style.display = 'none';
          parent.parentElement.style.margin = '0';
        }
      }
    }
    document.querySelectorAll<HTMLElement>('[data-qa*="city"], [data-testid*="city"], input[name="city"]').forEach((el) => {
      el.style.display = 'none';
      const p = el.closest('div');
      if (p) p.style.display = 'none';
    });
  };
  ocultarLocalizacao();

  // Substitui Gabriel Ferreira por Lucas Silva no ticker superior
  document.querySelectorAll<HTMLElement>('.funil-etapa-assinar span, .funil-etapa-assinar div').forEach((el) => {
    if (el.children.length === 0 && /Gabriel\s+Ferreira/i.test(el.textContent ?? '')) {
      el.textContent = el.textContent!.replace(/Gabriel\s+Ferreira/gi, 'Lucas Silva');
    }
  });

  // Ticker superior de signatários deslizando continuamente da esquerda para a direita
  const topTicker = document.querySelector<HTMLElement>('.funil-etapa-assinar .overflow-x-hidden, .funil-etapa-assinar .snap-x');
  if (topTicker) {
    topTicker.classList.remove('scroll-smooth');
    topTicker.style.scrollBehavior = 'auto';
    topTicker.style.overflowX = 'hidden';
    topTicker.style.display = 'flex';
    topTicker.style.whiteSpace = 'nowrap';

    if (!topTicker.getAttribute('data-ticker-duplicado')) {
      topTicker.setAttribute('data-ticker-duplicado', 'true');
      topTicker.innerHTML = topTicker.innerHTML + topTicker.innerHTML;
    }

    let scrollPos = 0;
    const timerTopScroll = setInterval(() => {
      if (!topTicker) return;
      scrollPos += 0.8;
      const meiaLargura = topTicker.scrollWidth / 2;
      if (meiaLargura > 0 && scrollPos >= meiaLargura) {
        scrollPos = 0;
      }
      topTicker.scrollLeft = scrollPos;
    }, 20);

    remocoes.push(() => clearInterval(timerTopScroll));
  }

  // Gerenciamento dos botões de rádio (Sim/Não) mutuamente exclusivos
  const optInRadio = document.querySelector<HTMLElement>('[data-qa="signform-gdprConsent-optIn-radio"]');
  const optOutRadio = document.querySelector<HTMLElement>('[data-qa="signform-gdprConsent-optOut-radio"]');
  const notPublicCheckbox = document.querySelector<HTMLElement>('[data-qa="signform-notPublic-checkbox"]');

  const inputOptIn = optInRadio?.querySelector<HTMLInputElement>('input[type="radio"]') || document.querySelector<HTMLInputElement>('input[value="true"]');
  const inputOptOut = optOutRadio?.querySelector<HTMLInputElement>('input[type="radio"]') || document.querySelector<HTMLInputElement>('input[value="false"]');
  const inputNotPublic = notPublicCheckbox?.querySelector<HTMLInputElement>('input[type="checkbox"]') || document.querySelector<HTMLInputElement>('input[name="notPublic"]');

  function selecionarRadio(sim: boolean) {
    if (inputOptIn) inputOptIn.checked = sim;
    if (inputOptOut) inputOptOut.checked = !sim;

    if (optInRadio) {
      if (sim) {
        optInRadio.setAttribute('data-selected', 'true');
        optInRadio.setAttribute('aria-checked', 'true');
        optInRadio.classList.add('is-selected');
        optInRadio.classList.remove('is-unselected');
      } else {
        optInRadio.setAttribute('data-selected', 'false');
        optInRadio.setAttribute('aria-checked', 'false');
        optInRadio.classList.remove('is-selected');
        optInRadio.classList.add('is-unselected');
      }
    }

    if (optOutRadio) {
      if (!sim) {
        optOutRadio.setAttribute('data-selected', 'true');
        optOutRadio.setAttribute('aria-checked', 'true');
        optOutRadio.classList.add('is-selected');
        optOutRadio.classList.remove('is-unselected');
      } else {
        optOutRadio.setAttribute('data-selected', 'false');
        optOutRadio.setAttribute('aria-checked', 'false');
        optOutRadio.classList.remove('is-selected');
        optOutRadio.classList.add('is-unselected');
      }
    }
  }

  // Inicializa "Sim!" como selecionado por padrão
  selecionarRadio(true);

  if (optInRadio) {
    remocoes.push(aoClicar(optInRadio, (ev) => {
      ev.preventDefault();
      selecionarRadio(true);
    }));
  }

  if (optOutRadio) {
    remocoes.push(aoClicar(optOutRadio, (ev) => {
      ev.preventDefault();
      selecionarRadio(false);
    }));
  }

  if (notPublicCheckbox) {
    remocoes.push(aoClicar(notPublicCheckbox, (ev) => {
      ev.preventDefault();
      if (inputNotPublic) {
        inputNotPublic.checked = !inputNotPublic.checked;
        const checked = inputNotPublic.checked;
        if (checked) {
          notPublicCheckbox.setAttribute('data-selected', 'true');
          notPublicCheckbox.setAttribute('aria-checked', 'true');
          notPublicCheckbox.classList.add('is-selected');
        } else {
          notPublicCheckbox.setAttribute('data-selected', 'false');
          notPublicCheckbox.setAttribute('aria-checked', 'false');
          notPublicCheckbox.classList.remove('is-selected');
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


