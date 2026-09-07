/* =============================================================================
   MEMÓRIA CURTA DOS PAGAMENTOS — SÓ NO SERVIDOR
   -----------------------------------------------------------------------------
   O webhook do Mercado Pago avisa da aprovação em segundos; o navegador do
   apoiador só descobre no próximo tick do polling. Guardar o desfecho aqui faz
   a tela virar no primeiro tick seguinte, sem uma ida à API do MP a cada 3s.

   É deliberadamente um Map em memória, não um banco: é um cache de conveniência
   com validade de minutos, e a fonte da verdade continua sendo a API do MP —
   se o processo reiniciar (ou se outra instância atender a consulta), o
   consultarStatus() cai na API e chega ao mesmo resultado. No dia em que houver
   um banco no projeto, é este arquivo que muda, e mais nada.
   ============================================================================= */

import type { PixStatus } from './pix-provider.server';

const VALIDADE_MS = 60 * 60 * 1000; // 1 hora — bem além da vida útil de um Pix na tela

type Registro = { status: PixStatus; em: number };

/* globalThis para sobreviver ao hot-reload do Next em desenvolvimento, que
   reavalia o módulo a cada troca de arquivo e zeraria um Map de módulo. */
const memoria: Map<string, Registro> =
  (globalThis as { __pixStore?: Map<string, Registro> }).__pixStore ??
  ((globalThis as { __pixStore?: Map<string, Registro> }).__pixStore = new Map());

function limpar(): void {
  const limite = Date.now() - VALIDADE_MS;
  for (const [id, reg] of memoria) if (reg.em < limite) memoria.delete(id);
}

export function registrarStatus(id: string, status: PixStatus): void {
  limpar();
  memoria.set(String(id), { status, em: Date.now() });
}

export function marcarPago(id: string): void {
  registrarStatus(id, 'pago');
}

export function statusConhecido(id: string): PixStatus | null {
  const reg = memoria.get(String(id));
  if (!reg) return null;
  if (reg.em < Date.now() - VALIDADE_MS) { memoria.delete(String(id)); return null; }
  // Só valem os desfechos definitivos: "pendente" deve sempre reconsultar.
  return reg.status === 'pendente' ? null : reg.status;
}
