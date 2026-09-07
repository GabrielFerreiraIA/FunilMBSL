import { CONFIG } from '../config';
import { Estado } from '../estado';
import { Track } from '../track';
import { ir, exigirAssinatura } from '../navegacao';
import { qa, aoClicar, toast, copiar } from '../dom';

const MARCAS: Record<string, (url: string, txt: string) => string> = {
  'psf-share-whatsapp-button': (url, txt) => `https://wa.me/?text=${encodeURIComponent(txt + ' ' + url)}`,
  'psf-share-facebook-button': (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  'psf-share-twitter-button': (url, txt) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(url)}`,
  'psf-share-email-button': (url, txt) => `mailto:?subject=${encodeURIComponent(CONFIG.campanha.titulo)}&body=${encodeURIComponent(txt + '\n\n' + url)}`,
  'psf-share-sms-button': (url, txt) => `sms:?&body=${encodeURIComponent(txt + ' ' + url)}`,
  'psf-share-facebookMessenger-button': (url) => `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=0&redirect_uri=${encodeURIComponent(url)}`
};

export function iniciarCompartilhar(): () => void {
  if (!exigirAssinatura()) return () => {};
  Track.ev('view_share');

  const lead = Estado.lead();
  const base = CONFIG.campanha.urlPublica;
  const q = new URLSearchParams({
    utm_source: 'share_petition',
    utm_medium: 'social',
    utm_campaign: CONFIG.campanha.id,
    recruiter: (lead.email ?? 'anon').replace(/[^a-z0-9]/gi, '').slice(0, 16)
  });
  const url = base + (base.includes('?') ? '&' : '?') + q.toString();
  const txt = `Assinei o abaixo-assinado "${CONFIG.campanha.titulo}". Assine você também:`;

  const remocoes: (() => void)[] = [];

  Object.entries(MARCAS).forEach(([qaNome, montarUrl]) => {
    remocoes.push(aoClicar(qa(qaNome), () => {
      Track.ev('compartilhou', { canal: qaNome.replace('psf-share-', '').replace('-button', '') });
      window.open(montarUrl(url, txt), '_blank', 'noopener');
    }));
  });

  // Instagram Stories não aceita link direto: copia e avisa.
  remocoes.push(aoClicar(qa('psf-share-instagramStories-button'), async () => {
    await copiar(url);
    toast('Link copiado! Cole no seu story.');
    Track.ev('compartilhou', { canal: 'instagram' });
  }));

  remocoes.push(aoClicar(qa('psf-share-copy-button'), async () => {
    await copiar(url);
    toast('Link copiado!');
    Track.ev('compartilhou', { canal: 'copiar_link' });
  }));

  // Mostra a URL real do funil no campo exibido.
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length === 0 && (el.textContent ?? '').includes('change.org/p/')) {
      el.textContent = url;
    }
  });

  const pularBtn = qa('skip-link');
  if (pularBtn) {
    remocoes.push(aoClicar(pularBtn, () => ir('obrigado')));
  } else {
    // Esta variante do capture não trouxe um botão de "continuar" — sem ele
    // o usuário fica sem saída da tela. Acrescenta um, no mesmo estilo visual
    // do resto do funil.
    const continuar = document.createElement('button');
    continuar.type = 'button';
    continuar.textContent = 'Continuar';
    continuar.style.cssText =
      'display:block;width:calc(100% - 32px);margin:24px 16px;min-height:52px;' +
      'border:1.5px solid #6f7381;border-radius:999px;background:transparent;' +
      'color:#2d2f37;font:600 16px/1.2 "Commissioner",ui-sans-serif,system-ui,sans-serif;cursor:pointer';
    remocoes.push(aoClicar(continuar, () => ir('obrigado')));
    const ancoraFinal = (document.querySelector('main') ?? document.body) as HTMLElement;
    ancoraFinal.appendChild(continuar);
    remocoes.push(() => continuar.remove());
  }

  return () => remocoes.forEach((f) => f());
}
