import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ADMIN, MAX_IDADE_COOKIE, credenciaisValidas, criarSessao } from '@/lib/admin.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!credenciaisValidas(body?.usuario, body?.senha)) {
    return NextResponse.json({ erro: 'Usuário ou senha inválidos.' }, { status: 401 });
  }

  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(COOKIE_ADMIN, criarSessao(), {
    httpOnly: true,               // fora do alcance de qualquer script na página
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_IDADE_COOKIE
  });
  return resp;
}

/** Logout. */
export async function DELETE() {
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(COOKIE_ADMIN, '', { path: '/', maxAge: 0 });
  return resp;
}
