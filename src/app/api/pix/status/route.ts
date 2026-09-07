import { NextRequest, NextResponse } from 'next/server';
import { consultarStatus } from '@/lib/pix-provider.server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ erro: 'Parâmetro "id" ausente.' }, { status: 400 });

  try {
    const resultado = await consultarStatus(id);
    return NextResponse.json(resultado);
  } catch (erro) {
    console.error('[api/pix/status]', erro);
    return NextResponse.json(
      { erro: 'Não foi possível consultar o status do Pix.' },
      { status: 502 }
    );
  }
}
