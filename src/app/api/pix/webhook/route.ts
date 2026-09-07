/* =============================================================================
   WEBHOOK DO MERCADO PAGO
   -----------------------------------------------------------------------------
   O MP chama esta rota assim que o Pix é pago (é a `notification_url` enviada
   na criação da cobrança). Guardamos o desfecho na memória curta para o
   polling da tela de pagamento virar no tick seguinte.

   A notificação NÃO traz o status: traz só o id do pagamento. Quem diz se foi
   aprovado é a própria API do MP, consultada aqui — assim uma requisição
   forjada não consegue marcar nada como pago.

   Configure em: Seus negócios → Configurações → Webhooks, apontando para
   https://SEU-DOMINIO/api/pix/webhook (evento "Pagamentos"). A chave secreta
   que o painel mostra vai em MERCADOPAGO_WEBHOOK_SECRET.
   ============================================================================= */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { buscarPagamentoMP, traduzirStatus, temMercadoPago } from '@/lib/pix-provider.server';
import { registrarStatus } from '@/lib/pix-store.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Valida o cabeçalho x-signature conforme a documentação de notificações do MP. */
function assinaturaValida(req: NextRequest, dataId: string): boolean {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  // Sem segredo configurado não há o que validar — a consulta à API do MP
  // logo abaixo continua sendo a garantia de que o status é verdadeiro.
  if (!segredo) return true;

  const assinatura = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const partes: { ts?: string; v1?: string } = {};
  for (const par of assinatura.split(',')) {
    const corte = par.indexOf('=');
    if (corte < 0) continue;
    const chave = par.slice(0, corte).trim();
    if (chave === 'ts' || chave === 'v1') partes[chave] = par.slice(corte + 1).trim();
  }

  if (!partes.ts || !partes.v1) return false;

  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${partes.ts};`;
  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');

  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(partes.v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  let corpo: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    corpo = await req.json();
  } catch {
    /* o MP às vezes notifica só por query string — tratado abaixo */
  }

  const id = String(
    corpo?.data?.id ?? req.nextUrl.searchParams.get('data.id') ?? req.nextUrl.searchParams.get('id') ?? ''
  );
  const tipo = corpo?.type ?? req.nextUrl.searchParams.get('type') ?? '';

  // Responder 200 mesmo ao ignorar: um erro faria o MP reenviar em looping.
  if (!id) return NextResponse.json({ ok: true, ignorado: 'sem id' });
  if (tipo && tipo !== 'payment') return NextResponse.json({ ok: true, ignorado: tipo });

  if (!assinaturaValida(req, id)) {
    console.warn('[api/pix/webhook] assinatura inválida para o pagamento', id);
    return NextResponse.json({ erro: 'assinatura inválida' }, { status: 401 });
  }

  if (!temMercadoPago()) return NextResponse.json({ ok: true, ignorado: 'sem token' });

  try {
    const pagamento = await buscarPagamentoMP(id);
    const status = traduzirStatus(pagamento.status);
    registrarStatus(id, status);
    return NextResponse.json({ ok: true, id, status });
  } catch (erro) {
    console.error('[api/pix/webhook]', erro);
    // 500 aqui é proposital: faz o MP tentar de novo mais tarde.
    return NextResponse.json({ erro: 'falha ao consultar o pagamento' }, { status: 500 });
  }
}

/** O painel do MP faz um GET de teste ao salvar a URL. */
export async function GET() {
  return NextResponse.json({ ok: true, servico: 'webhook pix' });
}
