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

  const submitBtn = qa('signform-submit-button') ?? document.querySelector('button[type="submit"]');
  if (submitBtn) {
    remocoes.push(aoClicar(submitBtn, enviar));
  }

  // enter em qualquer campo envia
  const onKeydown = (ev: KeyboardEvent) => { if (ev.key === 'Enter') { ev.preventDefault(); void enviar(); } };
  [nome, sobre, email, cidade].forEach((el) => el?.addEventListener('keydown', onKeydown));

  return () => {
    remocoes.forEach((f) => f());
    [nome, sobre, email, cidade].forEach((el) => el?.removeEventListener('keydown', onKeydown));
  };
}

