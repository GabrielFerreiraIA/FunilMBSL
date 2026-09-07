import { CONFIG } from '../config';
import { Track } from '../track';
import { ir, exigirAssinatura } from '../navegacao';
import { qa, aoClicar } from '../dom';
import { animarFeedDoadores } from './comuns';

export function iniciarTurbinar(): () => void {
  if (!exigirAssinatura()) return () => {};

  const ancora = CONFIG.contribuicao.valorAncora;
  Track.ev('view_upsell', { valor_ancora: ancora });

  const pararFeed = animarFeedDoadores();

  const remocoes = [
    pararFeed,
    aoClicar(qa('promote-button'), () => {
      Track.ev('aceite_upsell', { valor: ancora });
      ir('pagamento', { valor: ancora });
    }),
    aoClicar(qa('share-button-slide-up'), () => {
      Track.ev('recusa_upsell', { via: 'compartilhar' });
      ir('compartilhar');
    }),
    aoClicar(qa('skip-link'), () => {
      Track.ev('recusa_upsell', { via: 'agora_nao' });
      ir('compartilhar');
    })
  ];

  return () => remocoes.forEach((f) => f());
}

