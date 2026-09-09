/* =============================================================================
   CONFIGURAÇÃO DO FUNIL
   -----------------------------------------------------------------------------
   Único arquivo que você precisa editar para trocar campanha, valores e
   parâmetros de tracking. As rotas (app/.../page.tsx) e os endpoints de API
   (app/api/...) não precisam mudar.
   ============================================================================= */

export interface FunilConfig {
  marca: { nome: string; selo: string };
  campanha: { id: string; titulo: string; urlPublica: string };
  contribuicao: {
    valorAncora: number;
    valorPadrao: number;
    valorMinimo: number;
    valorMaximo: number;
    /** Quantas pessoas cada R$ 1 alcança — base do capture: R$ 15 -> 4.000. */
    pessoasPorReal: number;
    arredondarPara: number;
  };
  notificacoes: {
    ativo: boolean;
    primeiroApos: number;
    intervaloMin: number;
    intervaloMax: number;
    duracao: number;
  };
  pix: {
    intervaloPolling: number;
    expiracaoSegundos: number;
    exigirCPF: boolean;
    /** true = usa a resposta de demonstração; false = exige as chaves reais do PSP nas env vars do servidor. */
    modoSimulado: boolean;
  };
  api: { modoSimulado: boolean };
  tracking: {
    utmify: { ativo: boolean; enviarConversao: boolean };
    vturb: { ativo: boolean; playerId: string | null; contaId: string | null; liberarCtaAos: number };
    /* Grava cada evento em dados/eventos.jsonl via /api/eventos. */
    rastreio: { ativo: boolean };
    scrollDepth: number[];
  };
  utmsPreservadas: string[];
}

export const CONFIG: FunilConfig = {
  marca: { nome: 'Petição Pública', selo: 'P' },

  campanha: {
    id: 'impeachment-moraes',
    titulo: 'IMPEACHMENT DE ALEXANDRE DE MORAES - PELO BEM DA DEMOCRACIA',
    // PLACEHOLDER — troque pelo SEU domínio real antes de publicar. É para
    // onde os botões de compartilhar (etapa 5) apontam.
    urlPublica: 'https://mbsl.com.br/p/impeachment-de-alexandre-de-moraes'
  },

  contribuicao: {
    valorAncora: 15,
    valorPadrao: 200,
    valorMinimo: 5,
    valorMaximo: 5000,
    pessoasPorReal: 267,
    arredondarPara: 100
  },

  notificacoes: {
    ativo: true,
    primeiroApos: 6000,
    intervaloMin: 14000,
    intervaloMax: 26000,
    duracao: 6500
  },

  pix: {
    intervaloPolling: 3000,
    // O Mercado Pago só aceita expiração entre 30 minutos e 30 dias — 1800s
    // é o piso da API, não uma preferência nossa.
    expiracaoSegundos: 1800,
    exigirCPF: true,
    // Controlado por env var no SERVIDOR (veja app/api/pix/*/route.ts) — o
    // valor aqui é só o espelho usado pelo front para decidir textos de UI.
    modoSimulado: (process.env.NEXT_PUBLIC_PIX_MODO_SIMULADO ?? 'true') !== 'false'
  },

  api: { modoSimulado: true },

  tracking: {
    utmify: { ativo: true, enviarConversao: true },
    vturb: { ativo: false, playerId: null, contaId: null, liberarCtaAos: 0 },
    rastreio: { ativo: true },
    scrollDepth: [25, 50, 75, 90]
  },

  utmsPreservadas: [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'src', 'sck', 'xcod', 'fbclid', 'gclid', 'ttclid', 'ref', 'recruiter'
  ]
};

/** Ordem das etapas — usada pelas rotas para saber a próxima/anterior tela. */
export const ROTAS = {
  peticao: '/',
  assinar: '/assinar',
  turbinar: '/turbinar',
  pagamento: '/pagamento',
  checkout: '/checkout',
  pix: '/pix',
  compartilhar: '/compartilhar',
  obrigado: '/obrigado'
} as const;

export type EtapaId = keyof typeof ROTAS;
