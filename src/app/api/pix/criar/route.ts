import { NextRequest, NextResponse } from 'next/server';
import { criarCobranca, type PixInput } from '@/lib/pix-provider.server';
import { CONFIG } from '@/lib/config';

// Node runtime (não edge): precisamos do módulo `fetch` padrão do Node e,
// futuramente, de bibliotecas de PSP que não rodam em edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: PixInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 });
  }

  const valor = Number(body?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erro: 'Valor inválido.' }, { status: 400 });
  }

  /* Teto e piso vêm da configuração do funil — sem isso, qualquer um poderia
     mandar um valor arbitrário direto na API e gerar uma cobrança fora da
     faixa que a campanha oferece. */
  const { valorMinimo, valorMaximo } = CONFIG.contribuicao;
  if (valor < valorMinimo || valor > valorMaximo) {
    return NextResponse.json(
      { erro: `O valor precisa estar entre R$ ${valorMinimo} e R$ ${valorMaximo}.` },
      { status: 400 }
    );
  }

  try {
    const tx = await criarCobranca({
      valor,
      nome: body.nome,
      email: body.email,
      cpf: body.cpf ?? null,
      campanha: body.campanha,
      utms: body.utms
    });
    return NextResponse.json(tx);
  } catch (erro) {
    console.error('[api/pix/criar]', erro);
    return NextResponse.json(
      {
        erro: 'Não foi possível gerar o Pix no momento.',
        // O motivo real (recusa do PSP, chave Pix ausente, token errado) só
        // aparece fora de produção — em produção fica apenas no log.
        detalhe: process.env.NODE_ENV === 'production' ? undefined : String(erro)
      },
      { status: 502 }
    );
  }
}
