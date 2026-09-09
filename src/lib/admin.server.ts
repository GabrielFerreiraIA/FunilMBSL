/* =============================================================================
   AUTENTICAÇÃO DO PAINEL /admin
   -----------------------------------------------------------------------------
   Sessão sem estado: o cookie carrega o próprio prazo de validade e uma
   assinatura HMAC dele. Sem tabela de sessões, sem memória de processo — o que
   importa em serverless, onde cada requisição pode cair num processo novo.

   As credenciais default são admin/admin de propósito, para o MVP rodar sem
   configuração. Antes de publicar, defina ADMIN_USUARIO, ADMIN_SENHA e
   ADMIN_SECRET: esta tela lista nome e e-mail de quem assinou, que é dado
   pessoal sob a LGPD.
   ============================================================================= */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_ADMIN = 'funil_admin';
const VALIDADE_HORAS = 12;

const usuario = () => process.env.ADMIN_USUARIO ?? 'admin';
const senha = () => process.env.ADMIN_SENHA ?? 'admin';
const segredo = () => process.env.ADMIN_SECRET ?? 'funil-mbsl-segredo-de-desenvolvimento';

/** Comparação em tempo constante: `===` em string vaza, pelo tempo de resposta,
    quantos caracteres iniciais estavam certos. */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function credenciaisValidas(u: unknown, s: unknown): boolean {
  if (typeof u !== 'string' || typeof s !== 'string') return false;
  // Os dois lados sempre são avaliados: sair no primeiro erro diria ao
  // atacante se foi o usuário ou a senha que ele acertou.
  const okUsuario = iguais(u, usuario());
  const okSenha = iguais(s, senha());
  return okUsuario && okSenha;
}

function assinar(carga: string): string {
  return createHmac('sha256', segredo()).update(carga).digest('hex');
}

export function criarSessao(): string {
  const expiraEm = String(Date.now() + VALIDADE_HORAS * 3600_000);
  return `${expiraEm}.${assinar(expiraEm)}`;
}

export function sessaoValida(valor: string | undefined | null): boolean {
  if (!valor) return false;
  const [expiraEm, assinatura] = valor.split('.');
  if (!expiraEm || !assinatura) return false;
  if (!iguais(assinatura, assinar(expiraEm))) return false;
  return Number(expiraEm) > Date.now();
}

export const MAX_IDADE_COOKIE = VALIDADE_HORAS * 3600;
