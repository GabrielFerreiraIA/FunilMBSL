'use client';

import { useEffect, useState } from 'react';
import { Estado, fmtMoeda } from '@/lib/estado';
import { Track } from '@/lib/track';
import { CONFIG } from '@/lib/config';

export function ObrigadoClient() {
  const [nome, setNome] = useState('');
  const [mensagemContribuicao, setMensagemContribuicao] = useState<string | null>(null);

  useEffect(() => {
    Track.setEtapa('obrigado');
    const lead = Estado.lead();
    setNome(Estado.primeiroNome());
    if (lead.contribuiu && lead.valor) {
      setMensagemContribuicao(
        `Sua assinatura e sua contribuição de ${fmtMoeda(lead.valor)} foram registradas. Obrigado por turbinar esta causa.`
      );
    }
    Track.ev('view_obrigado', { contribuiu: !!lead.contribuiu, valor: lead.valor ?? 0 });
  }, []);

  return (
    <>
      <header className="hdr">
        <span className="mark">{CONFIG.marca.selo}</span>
        <span>Abaixo-assinado</span>
      </header>

      <main className="wrap">
        <div className="ok">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h1>{nome ? `${nome}, sua assinatura foi registrada!` : 'Sua assinatura foi registrada!'}</h1>
        <p className="lead">
          {mensagemContribuicao ?? 'Obrigado por fazer parte desta causa.'}
        </p>

        <div className="card">
          <h2>O que acontece agora</h2>
          <ol>
            <li><span className="n">1</span><span>Você receberá um e-mail de confirmação. Verifique também a caixa de spam.</span></li>
            <li><span className="n">2</span><span>Vamos avisar sempre que houver novidade sobre esta causa.</span></li>
            <li><span className="n">3</span><span>Ao atingir a meta, a petição será entregue ao destinatário.</span></li>
          </ol>
        </div>

        <a className="btn btn--p" href="/compartilhar">Compartilhar com mais pessoas</a>
        <a className="btn btn--o" href="/">Voltar ao abaixo-assinado</a>
      </main>

      <style>{`
        .hdr{height:56px;display:flex;align-items:center;padding:0 16px;
             border-bottom:1px solid #dde0e9;gap:8px;font-weight:700;font-size:18px;
             font-family:'Commissioner',ui-sans-serif,system-ui,sans-serif;color:#2d2f37}
        .mark{width:26px;height:26px;border-radius:999px;background:#f34e49;color:#fff;
              display:grid;place-items:center;font-size:14px;flex:none}
        .wrap{max-width:520px;margin:0 auto;padding:24px 16px;
              font-family:'Commissioner',ui-sans-serif,system-ui,sans-serif;color:#2d2f37}
        .ok{width:72px;height:72px;margin:16px auto;border-radius:999px;background:#f0fff0;
            color:#0f8110;display:grid;place-items:center}
        h1{font-size:26px;line-height:1.22;letter-spacing:-.02em;margin:0 0 12px;text-align:center}
        .lead{font-size:17px;color:#3a3e49cc;text-align:center;margin:0 0 24px}
        .card{background:#f8f9fd;border-radius:12px;padding:16px}
        .card h2{font-size:17px;margin:0 0 8px}
        ol{list-style:none;margin:0;padding:0}
        li{display:flex;gap:12px;align-items:flex-start;padding:8px 0;font-size:14px;line-height:1.5}
        .n{width:22px;height:22px;flex:none;border-radius:999px;background:#e2efff;color:#003193;
           display:grid;place-items:center;font-size:12px;font-weight:700}
        .btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;
             margin-top:12px;border:none;border-radius:999px;font-size:17px;font-weight:600;
             cursor:pointer;text-decoration:none;font-family:inherit}
        .btn--p{background:#f34e49;color:#fff}
        .btn--o{background:transparent;color:#2d2f37;border:1.5px solid #6f7381}
      `}</style>
    </>
  );
}
