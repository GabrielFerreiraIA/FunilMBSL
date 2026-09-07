import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/* Hoje o front funciona em modo simulado (config.api.modoSimulado) e nunca
   chama esta rota. Quando você quiser persistir assinaturas de verdade,
   ligue `api.modoSimulado = false` no front e implemente a gravação aqui —
   um banco (Postgres/Supabase/PlanetScale) ou uma planilha via API. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.nome) {
    return NextResponse.json({ erro: 'Nome e email são obrigatórios.' }, { status: 400 });
  }

  // TODO: gravar `body` no seu banco de dados.
  console.log('[api/assinaturas] nova assinatura (não persistida):', body);

  return NextResponse.json({ ok: true });
}
