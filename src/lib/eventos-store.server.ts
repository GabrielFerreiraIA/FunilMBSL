/* =============================================================================
   PERSISTÊNCIA DOS EVENTOS DO FUNIL
   -----------------------------------------------------------------------------
   Dois destinos, escolhidos pela presença das env vars:

   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  → grava na tabela `eventos`
   - nenhum dos dois                            → grava dados/eventos.jsonl

   O fallback em arquivo existe para o `next dev` funcionar sem credencial
   nenhuma. Ele NÃO é rede de segurança de produção: com as env vars presentes,
   uma falha do Supabase vira erro 500 em vez de cair para o disco em silêncio —
   telemetria gravada num disco efêmero de serverless é pior que telemetria
   perdida, porque parece que funcionou.

   Falamos com o Supabase pelo PostgREST via fetch, sem SDK: é um INSERT e um
   SELECT, e não vale uma dependência a mais num projeto que só tem quatro.
   ============================================================================= */

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface EventoGravavel {
  ts?: string;
  visitante_id?: string;
  sessao_id?: string;
  tipo?: string;
  evento?: string;
  etapa?: string | null;
  url?: string | null;
  referrer?: string | null;
  nome?: string | null;
  email?: string | null;
  utms?: Record<string, unknown>;
  dados?: Record<string, unknown>;
  ua?: string | null;
  recebido_em?: string;
}

const DIR = path.join(process.cwd(), 'dados');
const ARQUIVO = path.join(DIR, 'eventos.jsonl');
const TABELA = 'eventos';

export function usandoSupabase(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function cabecalhos(): Record<string, string> {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: chave,
    Authorization: `Bearer ${chave}`,
    'Content-Type': 'application/json'
  };
}

/* A service_role key ignora RLS — por isso ela só pode existir no servidor.
   Nunca prefixe com NEXT_PUBLIC_: isso a publicaria no bundle do navegador e
   daria a qualquer visitante acesso irrestrito de leitura e escrita à tabela. */
function urlBase(): string {
  return process.env.SUPABASE_URL!.replace(/\/+$/, '');
}

export async function gravarEventos(eventos: EventoGravavel[]): Promise<void> {
  if (!usandoSupabase()) {
    await mkdir(DIR, { recursive: true });
    await appendFile(ARQUIVO, eventos.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    return;
  }

  const resp = await fetch(`${urlBase()}/rest/v1/${TABELA}`, {
    method: 'POST',
    headers: { ...cabecalhos(), Prefer: 'return=minimal' },
    body: JSON.stringify(eventos),
    cache: 'no-store'
  });

  if (!resp.ok) {
    throw new Error(`Supabase respondeu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
}

export async function lerEventos(limite: number): Promise<{ total: number; eventos: unknown[] }> {
  if (!usandoSupabase()) {
    let bruto: string;
    try {
      bruto = await readFile(ARQUIVO, 'utf8');
    } catch {
      return { total: 0, eventos: [] };
    }
    const linhas = bruto.split('\n').filter(Boolean);
    const eventos = linhas
      .slice(-limite)
      .map((linha) => { try { return JSON.parse(linha) as unknown; } catch { return null; } })
      .filter((e): e is unknown => e !== null);
    return { total: linhas.length, eventos };
  }

  /* count=exact devolve o total da tabela no cabeçalho Content-Range
     ("0-99/12345") — evita um segundo round-trip só para contar. */
  const resp = await fetch(
    `${urlBase()}/rest/v1/${TABELA}?select=*&order=ts.desc&limit=${limite}`,
    { headers: { ...cabecalhos(), Prefer: 'count=exact' }, cache: 'no-store' }
  );

  if (!resp.ok) {
    throw new Error(`Supabase respondeu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }

  const eventos = (await resp.json()) as unknown[];
  const total = Number(resp.headers.get('content-range')?.split('/')[1]) || eventos.length;
  return { total, eventos };
}
