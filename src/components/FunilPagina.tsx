'use client';

/* =============================================================================
   Injeta o HTML capturado (public/content/*.html) e, só depois de ele estar
   de fato no DOM, liga o comportamento da etapa sobre ele.
   -----------------------------------------------------------------------------
   Por quê client-side em vez de dangerouslySetInnerHTML direto no servidor:
   os capturas trazem estruturas (players de vídeo com Shadow DOM declarativo,
   web components de terceiros) que o próprio processo de hidratação do React
   não consegue verificar com segurança quando pré-renderizadas no servidor —
   o navegador reestrutura essas partes da árvore de um jeito que o React não
   antecipa, travando a hidratação. Buscando e injetando o HTML já no cliente,
   depois que a hidratação terminou, eliminamos esse risco por completo,
   qualquer que seja a estrutura interna do capture.

   O arquivo é servido como um asset estático comum (cacheável, com o mesmo
   peso de antes) — só passa a chegar por um fetch() em vez de vir embutido
   na resposta inicial.
   ============================================================================= */

import { useEffect, useRef, useState } from 'react';
import { Estado } from '@/lib/estado';
import { Track } from '@/lib/track';
import { neutralizarExternos } from '@/lib/dom';
import { iniciarRastreio } from '@/lib/rastreio';
import { iniciarNotificacoes, pararNotificacoes } from '@/lib/notificacoes';
import { iniciarPeticao } from '@/lib/etapas/peticao';
import { iniciarAssinar } from '@/lib/etapas/assinar';
import { iniciarTurbinar } from '@/lib/etapas/turbinar';
import { iniciarPagamento } from '@/lib/etapas/pagamento';
import { iniciarCheckout } from '@/lib/etapas/checkout';
import { iniciarCompartilhar } from '@/lib/etapas/compartilhar';

export type EtapaBoot =
  | 'peticao' | 'assinar' | 'turbinar' | 'pagamento' | 'checkout' | 'compartilhar';

const INICIAR: Record<EtapaBoot, () => () => void> = {
  peticao: iniciarPeticao,
  assinar: iniciarAssinar,
  turbinar: iniciarTurbinar,
  pagamento: iniciarPagamento,
  checkout: iniciarCheckout,
  compartilhar: iniciarCompartilhar
};

export function FunilPagina({ arquivo, etapa }: { arquivo: string; etapa: EtapaBoot }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let pararEtapa: () => void = () => {};
    let pararScroll: () => void = () => {};
    let pararRastreio: () => void = () => {};
    let aoVisibilidadeMudar: (() => void) | null = null;

    async function montar() {
      const resp = await fetch(`/content/${arquivo}`);
      const html = await resp.text();
      if (cancelado || !containerRef.current) return;

      containerRef.current.innerHTML = html;
      setCarregado(true);

      // Só depois do HTML estar de fato no DOM é que ligamos o comportamento —
      // exatamente na ordem que o funil sempre teve.
      Estado.capturarUTMs();
      Track.setEtapa(etapa);
      neutralizarExternos();
      pararRastreio = iniciarRastreio();
      pararScroll = Track.scroll();

      aoVisibilidadeMudar = () => {
        if (document.hidden) pararNotificacoes();
        else iniciarNotificacoes();
      };
      document.addEventListener('visibilitychange', aoVisibilidadeMudar);
      iniciarNotificacoes();

      try {
        pararEtapa = INICIAR[etapa]();
      } catch (erro) {
        console.error(`[funil] erro ao iniciar a etapa "${etapa}"`, erro);
      }
    }

    void montar();

    return () => {
      cancelado = true;
      pararRastreio();
      pararScroll();
      if (aoVisibilidadeMudar) document.removeEventListener('visibilitychange', aoVisibilidadeMudar);
      pararNotificacoes();
      pararEtapa();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo, etapa]);

  return <div ref={containerRef} data-etapa={etapa} className={`funil-container funil-etapa-${etapa}`} aria-busy={!carregado} />;
}
