'use client';

/* =============================================================================
   ETAPA 4C · TELA DE PAGAMENTO PIX
   -----------------------------------------------------------------------------
   Página própria (não um capture injetado): o copia e cola, o QR e o
   cronômetro são elementos vivos, e reescrevê-los dentro do HTML capturado do
   checkout era o que existia antes — funcionava, mas prendia a tela ao layout
   de um modal e impedia recarregar a página sem perder a cobrança.

   Estrutura: um passo por bloco, na ordem em que a pessoa age — copiar,
   colar no banco, ou ler o QR. O aviso de "aguardando" fica sempre visível,
   porque a confirmação chega sozinha (polling em /api/pix/status, alimentado
   pelo webhook do Mercado Pago).
   ============================================================================= */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG, ROTAS } from '@/lib/config';
import { Estado, fmtMoeda } from '@/lib/estado';
import { Track } from '@/lib/track';
import { ir, link } from '@/lib/navegacao';
import { copiar, toast } from '@/lib/dom';
import {
  aguardarPagamento, pararPolling, lerTransacao, limparTransacao,
  type PixTransacao
} from '@/lib/pix-client';

type Situacao = 'aguardando' | 'pago' | 'expirado';

export function PixClient() {
  const [tx, setTx] = useState<(PixTransacao & { valor: number }) | null>(null);
  const [situacao, setSituacao] = useState<Situacao>('aguardando');
  const [restante, setRestante] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [nome, setNome] = useState('');
  const concluido = useRef(false);

  /* -- conclusão: só uma vez, venha do polling ou do botão manual -- */
  const concluir = useCallback((origem: 'automatico' | 'manual') => {
    if (concluido.current) return;
    concluido.current = true;
    pararPolling();
    setSituacao('pago');
    const atual = lerTransacao();
    Estado.salvar({ contribuiu: true });
    Track.ev('pagamento_ok', {
      valor: atual?.valor ?? 0,
      transacao_id: atual?.id,
      metodo: 'pix',
      confirmacao: origem
    });
    limparTransacao();
    // Um respiro para a tela mostrar o "confirmado" antes de trocar de página.
    setTimeout(() => ir('compartilhar'), 1200);
  }, []);

  /* -- carga inicial: pega a cobrança criada no checkout -- */
  useEffect(() => {
    Track.setEtapa('pix');
    Estado.capturarUTMs();
    setNome(Estado.primeiroNome());

    const guardada = lerTransacao();
    if (!guardada) {
      // Chegou aqui sem cobrança (recarregou depois de pagar, entrou pela URL
      // ou a sessão caiu) — volta para escolher o valor em vez de mostrar uma
      // tela vazia.
      window.location.replace(link(ROTAS.pagamento));
      return;
    }

    setTx(guardada);
    Track.ev('view_pix', { valor: guardada.valor, transacao_id: guardada.id, simulado: guardada.simulado });

    aguardarPagamento(
      guardada.id,
      () => concluir('automatico'),
      () => setSituacao('expirado')
    );

    return () => pararPolling();
  }, [concluir]);

  /* -- cronômetro -- */
  useEffect(() => {
    if (!tx) return;
    const fim = new Date(tx.expiraEm).getTime();
    const tick = () => {
      const s = Math.max(0, Math.floor((fim - Date.now()) / 1000));
      setRestante(s);
      if (s <= 0 && !concluido.current) setSituacao('expirado');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tx]);

  async function aoCopiar() {
    if (!tx) return;
    await copiar(tx.copiaECola);
    setCopiado(true);
    toast('Código Pix copiado!');
    Track.ev('pix_copiado', { valor: tx.valor });
    setTimeout(() => setCopiado(false), 2600);
  }

  function refazer() {
    limparTransacao();
    window.location.href = link(ROTAS.checkout);
  }

  if (!tx) {
    return (
      <main className="pix-carregando">
        <div className="pix-spinner" aria-hidden />
        <p>Preparando seu Pix…</p>
        <Estilos />
      </main>
    );
  }

  const mm = String(Math.floor((restante ?? 0) / 60)).padStart(2, '0');
  const ss = String((restante ?? 0) % 60).padStart(2, '0');
  const expirado = situacao === 'expirado';
  const pago = situacao === 'pago';

  return (
    <>
      {/* ---------------------------------------------------------------
          TOPO — mesma promessa da etapa anterior, agora em tom de "falta só
          confirmar". A pessoa já decidiu; aqui o trabalho é não deixá-la
          duvidar no meio do caminho.
          --------------------------------------------------------------- */}
      <header className="pix-hero">
        <div className="pix-hero-top-bar">
          <div className="pix-hero-marca">
            <span className="pix-selo">{CONFIG.marca.selo}</span>
            <span>{CONFIG.marca.nome}</span>
          </div>

          <span className={`pix-status-pill ${pago ? 'is-pago' : expirado ? 'is-expirado' : ''}`}>
            <i className="pix-dot" />
            {pago ? 'Contribuição confirmada' : expirado ? 'Código expirado' : 'Aguardando pagamento'}
          </span>
        </div>

        <h1>
          {pago ? 'Recebemos!' : <>Falta <em>pouco</em></>}
        </h1>

        <p className="pix-hero-sub">
          {pago
            ? 'Sua contribuição foi confirmada. Estamos te levando para a próxima etapa…'
            : <>
                {nome ? `${nome}, sua ` : 'Sua '}contribuição de <strong>{fmtMoeda(tx.valor)}</strong> será
                confirmada assim que o Pix cair.
              </>}
        </p>

        {!pago && (
          <p className="pix-hero-campanha">
            Para impulsionar <strong>{CONFIG.campanha.titulo}</strong>
          </p>
        )}
      </header>

      <main className="pix-wrap">
        {/* -- alerta de expiração / demonstração ------------------------- */}
        {expirado && (
          <div className="pix-alerta">
            <strong>Este código Pix expirou.</strong>
            <span>Gere outro para concluir sua contribuição — leva menos de 10 segundos.</span>
            <button type="button" className="pix-btn pix-btn--principal" onClick={refazer}>
              Gerar um novo código
            </button>
          </div>
        )}

        {tx.simulado && !expirado && (
          <div className="pix-aviso-demo">
            <strong>Modo demonstração.</strong> Nenhuma cobrança real está sendo feita — configure
            a variável <code>MERCADOPAGO_ACCESS_TOKEN</code> para ativar o Pix de verdade.
          </div>
        )}

        {!expirado && (
          <>
            {/* -- PASSO 1 · copia e cola -------------------------------- */}
            <section className="pix-card">
              <h2><span className="pix-num">1</span> Copie o código Pix</h2>

              <div className="pix-codigo-box">
                <span className="pix-codigo-rotulo">Pix copia e cola</span>
                <p className="pix-codigo">{tx.copiaECola}</p>
              </div>

              <button
                type="button"
                className={`pix-btn pix-btn--principal ${copiado ? 'is-copiado' : ''}`}
                onClick={aoCopiar}
              >
                {copiado ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Código copiado!
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="12" height="12" rx="2.5" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copiar código Pix
                  </>
                )}
              </button>
            </section>

            {/* -- PASSO 2 · o que fazer no banco ------------------------ */}
            <section className="pix-card">
              <h2><span className="pix-num">2</span> Finalize no seu banco</h2>

              <ol className="pix-passos">
                <li>
                  <span className="pix-passo-icone" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                    </svg>
                  </span>
                  <span><b>Passo 1</b>Abra o app do seu <em>banco</em></span>
                </li>
                <li>
                  <span className="pix-passo-icone" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" />
                    </svg>
                  </span>
                  <span><b>Passo 2</b>Vá em <em>Pix → Pagar → Pix copia e cola</em> e cole o código</span>
                </li>
                <li>
                  <span className="pix-passo-icone" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" />
                    </svg>
                  </span>
                  <span><b>Passo 3</b>Confira o valor de <em>{fmtMoeda(tx.valor)}</em> e finalize</span>
                </li>
              </ol>
            </section>

            {/* -- PASSO 3 · QR Code ------------------------------------- */}
            <section className="pix-card pix-card--qr">
              <h2 className="pix-qr-titulo">Ou escaneie o QR Code</h2>

              <div className="pix-qr-moldura">
                {tx.qrCodeBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tx.qrCodeBase64} alt="QR Code para pagamento via Pix" />
                ) : (
                  <div className="pix-qr-vazio">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2zM19 14h2v2h-2z" />
                    </svg>
                    <span>QR indisponível<br />Use o código copia e cola acima</span>
                  </div>
                )}
              </div>

              <p className="pix-qr-legenda">Aponte a câmera do seu celular para o QR Code no app do banco</p>

              {tx.ticketUrl && (
                <a className="pix-link-ticket" href={tx.ticketUrl} target="_blank" rel="noopener noreferrer">
                  Abrir página de pagamento do Mercado Pago
                </a>
              )}
            </section>

            {/* -- rodapé de status ------------------------------------- */}
            <section className="pix-rodape">
              <div className={`pix-aguardando ${pago ? 'is-pago' : ''}`}>
                {pago ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Pagamento confirmado
                  </>
                ) : (
                  <>
                    <i className="pix-pulso" aria-hidden />
                    Aguardando o pagamento… a confirmação é automática
                  </>
                )}
              </div>

              {!pago && restante !== null && (
                <p className="pix-timer">
                  Este código expira em <strong>{mm}:{ss}</strong>
                </p>
              )}

              {!pago && (
                <button type="button" className="pix-btn pix-btn--secundario" onClick={() => concluir('manual')}>
                  Já fiz o pagamento
                </button>
              )}

              <div className="pix-seguranca">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
                Pagamento processado com segurança via Pix · Mercado Pago
              </div>
            </section>
          </>
        )}
      </main>

      <Estilos />
    </>
  );
}

/* =============================================================================
   ESTILO — os mesmos tokens do resto do funil: fonte Commissioner, amarelo
   #facc15→#eab308 no CTA, neutros slate, cartões de raio 20px.
   ============================================================================= */
function Estilos() {
  return (
    <style>{`
      html, body { background: #f6f7fb; }

      .pix-carregando, .pix-hero, .pix-wrap {
        font-family: 'Commissioner', ui-sans-serif, system-ui, -apple-system, sans-serif;
        color: #0f172a;
      }

      .pix-carregando {
        min-height: 70vh; display: grid; place-content: center; justify-items: center;
        gap: 14px; color: #64748b; font-weight: 600;
      }
      .pix-spinner {
        width: 34px; height: 34px; border-radius: 50%;
        border: 3px solid #e2e8f0; border-top-color: #eab308;
        animation: pixGira .8s linear infinite;
      }
      @keyframes pixGira { to { transform: rotate(360deg); } }

      /* ---- topo ---- */
      .pix-hero {
        background: linear-gradient(165deg, #1e293b 0%, #0f172a 62%, #172554 100%);
        color: #fff; padding: 22px 20px 54px; text-align: center;
        border-radius: 0 0 28px 28px; position: relative;
        display: flex; flex-direction: column; align-items: center;
      }
      .pix-hero-top-bar {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; max-width: 480px; margin: 0 auto 16px; gap: 12px;
      }
      @media (max-width: 440px) {
        .pix-hero-top-bar {
          flex-direction: column; justify-content: center; gap: 10px; text-align: center;
        }
      }
      .pix-hero-marca {
        display: inline-flex; align-items: center; gap: 8px;
        font-weight: 700; font-size: 14px; color: #cbd5e1; margin: 0;
      }
      .pix-selo {
        width: 24px; height: 24px; border-radius: 999px; background: #f34e49; color: #fff;
        display: grid; place-items: center; font-size: 13px; font-weight: 800;
      }
      .pix-status-pill {
        display: inline-flex; align-items: center; gap: 8px;
        background: rgba(250, 204, 21, .14); border: 1px solid rgba(250, 204, 21, .38);
        color: #fde68a; font-size: 12px; font-weight: 800; letter-spacing: .04em;
        text-transform: uppercase; padding: 6px 14px; border-radius: 999px; margin: 0;
        white-space: nowrap;
      }
      .pix-status-pill.is-pago { background: rgba(34,197,94,.16); border-color: rgba(34,197,94,.42); color: #86efac; }
      .pix-status-pill.is-expirado { background: rgba(248,113,113,.16); border-color: rgba(248,113,113,.42); color: #fca5a5; }
      .pix-dot {
        width: 7px; height: 7px; border-radius: 999px; background: currentColor;
        animation: pixPisca 1.6s ease-in-out infinite;
      }
      @keyframes pixPisca { 50% { opacity: .25; } }

      .pix-hero h1 {
        font-size: 42px; line-height: 1.06; letter-spacing: -.035em; font-weight: 800;
        margin: 14px 0 10px;
      }
      .pix-hero h1 em {
        font-style: italic; font-weight: 800;
        background: linear-gradient(180deg, #fde68a 0%, #facc15 100%);
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .pix-hero-sub { font-size: 15.5px; line-height: 1.55; color: #cbd5e1; margin: 0 auto; max-width: 420px; }
      .pix-hero-sub strong { color: #fff; }
      .pix-hero-campanha {
        font-size: 13px; line-height: 1.5; color: #94a3b8; margin: 12px auto 0; max-width: 400px;
      }
      .pix-hero-campanha strong { color: #e2e8f0; font-weight: 700; }

      /* ---- corpo ---- */
      .pix-wrap { max-width: 480px; margin: -34px auto 0; padding: 0 16px 40px; position: relative; }

      .pix-card {
        background: #fff; border: 1px solid #e2e8f0; border-radius: 20px;
        box-shadow: 0 18px 38px -18px rgba(15, 23, 42, .22);
        padding: 20px; margin-bottom: 14px;
      }
      .pix-card h2 {
        display: flex; align-items: center; gap: 10px;
        font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
        color: #475569; margin: 0 0 14px;
      }
      .pix-num {
        width: 24px; height: 24px; flex: none; border-radius: 999px;
        background: linear-gradient(180deg, #facc15 0%, #eab308 100%); color: #0f172a;
        display: grid; place-items: center; font-size: 13px; font-weight: 800; letter-spacing: 0;
      }

      .pix-codigo-box {
        background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 13px 15px;
      }
      .pix-codigo-rotulo {
        display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .09em;
        text-transform: uppercase; color: #94a3b8; margin-bottom: 5px;
      }
      .pix-codigo {
        margin: 0; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px;
        line-height: 1.45; color: #334155; word-break: break-all;
        max-height: 54px; overflow: hidden;
        /* Duas linhas bastam para dar prova de que o código está ali — o que
           importa é o botão de copiar, não ler 200 caracteres na tela. */
        display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      }

      .pix-btn {
        width: 100%; min-height: 54px; border: none; border-radius: 14px; cursor: pointer;
        font-family: inherit; font-size: 17px; font-weight: 800; letter-spacing: -.2px;
        display: flex; align-items: center; justify-content: center; gap: 9px;
        transition: transform .15s ease, box-shadow .15s ease, background .2s ease;
      }
      .pix-btn--principal {
        margin-top: 14px; color: #0f172a;
        background: linear-gradient(180deg, #facc15 0%, #eab308 100%);
        box-shadow: 0 6px 20px -2px rgba(234, 179, 8, .45);
      }
      .pix-btn--principal:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -2px rgba(234,179,8,.55); }
      .pix-btn--principal:active { transform: translateY(1px) scale(.99); }
      .pix-btn--principal.is-copiado {
        background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%); color: #fff;
        box-shadow: 0 6px 20px -2px rgba(22, 163, 74, .45);
      }
      .pix-btn--secundario {
        margin-top: 14px; background: transparent; color: #334155;
        border: 1.5px solid #cbd5e1; font-size: 15.5px; font-weight: 700; min-height: 50px;
      }
      .pix-btn--secundario:hover { background: #f1f5f9; }

      /* ---- passos ---- */
      .pix-passos { list-style: none; margin: 0; padding: 0; }
      .pix-passos li {
        display: flex; gap: 13px; align-items: flex-start; padding: 13px 0;
        border-bottom: 1px solid #f1f5f9; font-size: 14.5px; line-height: 1.5; color: #334155;
      }
      .pix-passos li:last-child { border-bottom: none; padding-bottom: 0; }
      .pix-passos li:first-child { padding-top: 0; }
      .pix-passo-icone {
        width: 38px; height: 38px; flex: none; border-radius: 11px;
        background: #fefce8; color: #a16207; display: grid; place-items: center;
      }
      .pix-passos b {
        display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .09em;
        text-transform: uppercase; color: #94a3b8; margin-bottom: 2px;
      }
      .pix-passos em { font-style: normal; font-weight: 800; color: #0f172a; }

      /* ---- QR ---- */
      .pix-card--qr { text-align: center; }
      .pix-qr-titulo { justify-content: center; }
      .pix-qr-moldura {
        width: 210px; height: 210px; margin: 0 auto; padding: 10px; box-sizing: border-box;
        background: #fff; border: 2px dashed #e2e8f0; border-radius: 18px;
      }
      .pix-qr-moldura img { width: 100%; height: 100%; object-fit: contain; display: block; }
      .pix-qr-vazio {
        height: 100%; display: grid; place-content: center; justify-items: center; gap: 10px;
        color: #94a3b8; font-size: 12px; line-height: 1.45;
      }
      .pix-qr-legenda { font-size: 13px; color: #64748b; margin: 14px 0 0; line-height: 1.5; }
      .pix-link-ticket {
        display: inline-block; margin-top: 10px; font-size: 13px; font-weight: 700;
        color: #1d4ed8; text-decoration: underline;
      }

      /* ---- rodapé de status ---- */
      .pix-rodape { text-align: center; padding: 6px 4px 0; }
      .pix-aguardando {
        display: inline-flex; align-items: center; gap: 9px;
        background: #fff; border: 1px solid #e2e8f0; border-radius: 999px;
        padding: 10px 18px; font-size: 13.5px; font-weight: 700; color: #475569;
        box-shadow: 0 6px 18px -12px rgba(15,23,42,.4);
      }
      .pix-aguardando.is-pago { border-color: #86efac; background: #f0fdf4; color: #15803d; }
      .pix-pulso {
        width: 9px; height: 9px; border-radius: 999px; background: #eab308; flex: none;
        box-shadow: 0 0 0 0 rgba(234, 179, 8, .6); animation: pixOnda 1.8s ease-out infinite;
      }
      @keyframes pixOnda {
        70% { box-shadow: 0 0 0 9px rgba(234, 179, 8, 0); }
        100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
      }
      .pix-timer { font-size: 13px; color: #64748b; margin: 12px 0 0; }
      .pix-timer strong { color: #0f172a; font-variant-numeric: tabular-nums; }
      .pix-seguranca {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        margin-top: 18px; font-size: 12px; color: #94a3b8; font-weight: 600;
      }

      /* ---- avisos ---- */
      .pix-alerta {
        background: #fff; border: 1.5px solid #fecaca; border-radius: 20px; padding: 22px 20px;
        display: flex; flex-direction: column; gap: 6px; text-align: center;
        box-shadow: 0 18px 38px -18px rgba(15, 23, 42, .22);
      }
      .pix-alerta strong { font-size: 17px; color: #b91c1c; }
      .pix-alerta span { font-size: 14px; color: #64748b; line-height: 1.5; }
      .pix-aviso-demo {
        background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px;
        padding: 12px 14px; margin-bottom: 14px; font-size: 12.5px; line-height: 1.55; color: #92400e;
      }
      .pix-aviso-demo code {
        font-family: ui-monospace, monospace; font-size: 11.5px;
        background: #fef3c7; padding: 1px 5px; border-radius: 5px;
      }

      @media (min-width: 640px) {
        .pix-hero { padding-top: 30px; }
        .pix-hero h1 { font-size: 48px; }
      }
    `}</style>
  );
}
