'use client';

/* =============================================================================
   DASHBOARD DE TELEMETRIA
   -----------------------------------------------------------------------------
   Lê /api/eventos e mostra o que o funil registrou: quem passou por cada etapa,
   quem apertou qual botão e quem virou assinatura.

   Não existe estado de "logado" guardado aqui. A fonte da verdade é o cookie
   httpOnly, que esta página não consegue ler — então a tela de login aparece
   quando a API responde 401, e some quando ela responde 200. Um booleano local
   só dessincronizaria do cookie no primeiro expirar de sessão.
   ============================================================================= */

import { useCallback, useEffect, useMemo, useState } from 'react';
import css from './admin.module.css';

interface Evento {
  ts: string;
  recebido_em?: string;
  visitante_id: string;
  sessao_id: string;
  tipo: 'pageview' | 'clique' | 'nomeado';
  evento: string;
  etapa: string | null;
  url: string | null;
  nome: string | null;
  email: string | null;
  utms: Record<string, string>;
  dados: Record<string, unknown>;
}

const CLASSE_TAG: Record<Evento['tipo'], string> = {
  pageview: css.tagPageview!,
  clique: css.tagClique!,
  nomeado: css.tagNomeado!
};

function horario(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

/** O rótulo do clique mora em dados.rotulo; o dos eventos nomeados, em campos
    variados. Mostra o mais informativo que houver, sem despejar o JSON cru. */
function descrever(ev: Evento): string {
  const d = ev.dados ?? {};
  const partes = [d.rotulo, d.qa, d.canal, d.valor != null ? `R$ ${d.valor}` : null, d.profundidade != null ? `${d.profundidade}%` : null]
    .filter((p) => p != null && p !== '')
    .map(String);
  return partes.length ? partes.join(' · ') : '—';
}

export function AdminClient() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [fonte, setFonte] = useState('');
  const [erroCarga, setErroCarga] = useState('');
  const [carregando, setCarregando] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga('');
    try {
      const resp = await fetch('/api/eventos?limite=500', { cache: 'no-store' });
      if (resp.status === 401) { setAutenticado(false); return; }
      const json = await resp.json();
      if (!resp.ok) { setErroCarga(json?.erro ?? 'Falha ao carregar.'); setAutenticado(true); return; }
      setEventos(json.eventos ?? []);
      setTotal(json.total ?? 0);
      setFonte(json.fonte ?? '');
      setAutenticado(true);
    } catch {
      setErroCarga('Não foi possível falar com a API.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function entrar(ev: React.FormEvent) {
    ev.preventDefault();
    setEntrando(true);
    setErro('');
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha })
      });
      if (!resp.ok) { setErro('Usuário ou senha inválidos.'); return; }
      setSenha('');
      await carregar();
    } catch {
      setErro('Falha na conexão.');
    } finally {
      setEntrando(false);
    }
  }

  async function sair() {
    await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => {});
    setEventos([]);
    setAutenticado(false);
  }

  const metricas = useMemo(() => {
    const visitantes = new Set(eventos.map((e) => e.visitante_id));
    const sessoes = new Set(eventos.map((e) => e.sessao_id));
    const assinaturas = new Set(
      eventos.filter((e) => e.evento === 'assinatura').map((e) => e.visitante_id)
    );
    return {
      visitantes: visitantes.size,
      sessoes: sessoes.size,
      pageviews: eventos.filter((e) => e.tipo === 'pageview').length,
      cliques: eventos.filter((e) => e.tipo === 'clique').length,
      assinaturas: assinaturas.size
    };
  }, [eventos]);

  const nomesDeEvento = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.evento))).sort(),
    [eventos]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return eventos.filter((e) => {
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo && e.evento !== filtroTipo) return false;
      if (!termo) return true;
      return [e.nome, e.email, e.evento, e.etapa, e.visitante_id, descrever(e)]
        .some((campo) => (campo ?? '').toLowerCase().includes(termo));
    });
  }, [eventos, filtroTipo, busca]);

  if (autenticado === null) {
    return <div className={css.tela}><div className={css.limite}>Carregando…</div></div>;
  }

  if (!autenticado) {
    return (
      <div className={css.tela}>
        <form className={css.caixaLogin} onSubmit={entrar}>
          <h1>Dashboard do funil</h1>
          <p>Telemetria de cliques e etapas.</p>
          <label className={css.campo}>
            <span>Usuário</span>
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className={css.campo}>
            <span>Senha</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
          </label>
          <button className={css.botao} type="submit" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
          {erro && <p className={css.erro}>{erro}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className={css.tela}>
      <div className={css.limite}>
        <div className={css.topo}>
          <h1>Dashboard do funil</h1>
          {fonte && <span className={css.fonte}>{fonte}</span>}
          <span className={css.espaco} />
          <button className={css.link} onClick={() => void carregar()} disabled={carregando}>
            {carregando ? 'atualizando…' : 'atualizar'}
          </button>
          <button className={css.link} onClick={() => void sair()}>sair</button>
        </div>

        {fonte === 'arquivo' && (
          <p className={css.aviso}>
            Gravando em <code>dados/eventos.jsonl</code>. Para usar o Supabase, defina{' '}
            <code>SUPABASE_URL</code> e <code>SUPABASE_SERVICE_ROLE_KEY</code> e rode{' '}
            <code>supabase/schema.sql</code>.
          </p>
        )}
        {erroCarga && <p className={css.aviso}>{erroCarga}</p>}

        <div className={css.metricas}>
          <div className={css.metrica}><b>{metricas.visitantes}</b><span>visitantes únicos</span></div>
          <div className={css.metrica}><b>{metricas.sessoes}</b><span>sessões</span></div>
          <div className={css.metrica}><b>{metricas.pageviews}</b><span>pageviews</span></div>
          <div className={css.metrica}><b>{metricas.cliques}</b><span>cliques</span></div>
          <div className={css.metrica}><b>{metricas.assinaturas}</b><span>assinaturas</span></div>
        </div>

        <div className={css.filtros}>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            <option value="pageview">pageview</option>
            <option value="clique">clique</option>
            <option value="nomeado">nomeado</option>
            {nomesDeEvento.length > 0 && <option disabled>──────────</option>}
            {nomesDeEvento.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail, botão, etapa, visitante…"
          />
        </div>

        <div className={css.rolagem}>
          <table className={css.tabela}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Tipo</th>
                <th>Evento</th>
                <th>Detalhe</th>
                <th>Etapa</th>
                <th>Quem</th>
                <th>Visitante</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((ev, i) => (
                <tr key={`${ev.visitante_id}-${ev.ts}-${i}`}>
                  <td className={`${css.mono} ${css.nowrap}`}>{horario(ev.ts)}</td>
                  <td><span className={`${css.tag} ${CLASSE_TAG[ev.tipo] ?? ''}`}>{ev.tipo}</span></td>
                  <td>{ev.evento}</td>
                  <td>{descrever(ev)}</td>
                  <td>{ev.etapa ?? '—'}</td>
                  <td>{ev.nome ? <>{ev.nome}<br /><span className={css.mono}>{ev.email}</span></> : <span className={css.mono}>anônimo</span>}</td>
                  <td className={css.mono}>{ev.visitante_id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <p className={css.vazio}>
              {eventos.length === 0
                ? 'Nenhum evento ainda. Passe pelo funil numa outra aba e volte aqui.'
                : 'Nenhum evento bate com o filtro.'}
            </p>
          )}
        </div>

        <p className={css.mono} style={{ marginTop: 12 }}>
          exibindo {filtrados.length} de {eventos.length} carregados · {total} no total
        </p>
      </div>
    </div>
  );
}
