/* =============================================================================
   /api/eventos — SINK DE TELEMETRIA DO FUNIL
   -----------------------------------------------------------------------------
   POST  grava um lote de eventos (chamado pelo sendBeacon do rastreio.ts).
   GET   lê os eventos para o painel /admin.

   Onde grava é decisão do eventos-store.server.ts: Supabase quando há
   credencial, arquivo local quando não há.
   ============================================================================= */

import { NextRequest, NextResponse } from 'next/server';
import { gravarEventos, lerEventos, usandoSupabase, type EventoGravavel } from '@/lib/eventos-store.server';
import { COOKIE_ADMIN, sessaoValida } from '@/lib/admin.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Limites para que um cliente hostil (ou um bug de loop) não despeje lixo
   ilimitado na tabela. */
const MAX_EVENTOS_POR_LOTE = 50;
const MAX_BYTES_POR_EVENTO = 4000;

const TIPOS = new Set(['pageview', 'clique', 'nomeado']);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const recebidos: Record<string, unknown>[] | null =
    Array.isArray(body?.eventos) ? (body.eventos as Record<string, unknown>[]) : null;

  if (!recebidos || recebidos.length === 0) {
    return NextResponse.json({ erro: 'Envie { eventos: [...] }.' }, { status: 400 });
  }

  /* O user agent vem do cabeçalho, não do corpo — o cliente não tem por que ser
     a fonte disso. IP não é gravado de propósito: é dado pessoal sob a LGPD e
     nada no funil precisa dele. */
  const ua = req.headers.get('user-agent');
  const recebidoEm = new Date().toISOString();

  const texto = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null;

  const eventos: EventoGravavel[] = recebidos
    .slice(0, MAX_EVENTOS_POR_LOTE)
    .map((bruto: Record<string, unknown>): EventoGravavel | null => {
      const tipo = texto(bruto?.tipo);
      const evento = texto(bruto?.evento);
      const visitanteId = texto(bruto?.visitante_id);
      // Sem os três, a linha não responde a nenhuma pergunta que justifique
      // guardá-la — descarta em vez de gravar um registro órfão.
      if (!tipo || !TIPOS.has(tipo) || !evento || !visitanteId) return null;

      return {
        ts: texto(bruto?.ts) ?? recebidoEm,
        recebido_em: recebidoEm,
        visitante_id: visitanteId,
        sessao_id: texto(bruto?.sessao_id) ?? visitanteId,
        tipo,
        evento,
        etapa: texto(bruto?.etapa),
        url: texto(bruto?.url),
        referrer: texto(bruto?.referrer),
        nome: texto(bruto?.nome),
        email: texto(bruto?.email),
        utms: (bruto?.utms as Record<string, unknown>) ?? {},
        dados: (bruto?.dados as Record<string, unknown>) ?? {},
        ua
      };
    })
    .filter((e): e is EventoGravavel => e !== null && JSON.stringify(e).length <= MAX_BYTES_POR_EVENTO);

  if (eventos.length === 0) {
    return NextResponse.json({ erro: 'Nenhum evento válido.' }, { status: 400 });
  }

  try {
    await gravarEventos(eventos);
  } catch (erro) {
    console.error('[api/eventos] falha ao gravar', erro);
    return NextResponse.json({ erro: 'Falha ao gravar.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, gravados: eventos.length });
}

/* Leitura: as linhas trazem nome e e-mail de quem assinou, então exige a sessão
   do painel. RASTREIO_TOKEN continua valendo para consumo por script. */
export async function GET(req: NextRequest) {
  const token = process.env.RASTREIO_TOKEN;
  const autorizado =
    sessaoValida(req.cookies.get(COOKIE_ADMIN)?.value) ||
    (!!token && req.nextUrl.searchParams.get('token') === token);

  if (!autorizado) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const limite = Math.min(Number(req.nextUrl.searchParams.get('limite')) || 200, 1000);

  try {
    const { total, eventos } = await lerEventos(limite);
    return NextResponse.json({ total, eventos, fonte: usandoSupabase() ? 'supabase' : 'arquivo' });
  } catch (erro) {
    console.error('[api/eventos] falha ao ler', erro);
    return NextResponse.json({ erro: String(erro) }, { status: 500 });
  }
}
