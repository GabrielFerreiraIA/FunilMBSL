/* =============================================================================
   NAVEGAÇÃO ENTRE ETAPAS
   -----------------------------------------------------------------------------
   Usa navegação de página inteira (window.location), não o router client-side
   do Next. Cada etapa carrega um HTML gigante e auto-contido (o capture
   original, com seus próprios <style>); trocar de etapa sem recarregar a
   página arriscaria misturar classes/estilos de uma etapa com os de outra.
   Uma troca de página cheia elimina esse risco — e o custo é imperceptível
   numa jornada de poucas telas como esta.
   ============================================================================= */

import { CONFIG, ROTAS, type EtapaId } from './config';
import { Estado, type Lead } from './estado';

/** Caminho de uma etapa já com as UTMs da sessão coladas. */
export function link(caminho: string): string {
  const utms = Estado.utms();
  const q = new URLSearchParams();
  for (const chave of CONFIG.utmsPreservadas) {
    const v = utms[chave];
    if (v) q.set(chave, v);
  }
  const s = q.toString();
  return caminho + (s ? (caminho.includes('?') ? '&' : '?') + s : '');
}

export function ir(etapa: EtapaId, extras?: Partial<Lead>): void {
  if (extras) Estado.salvar(extras);
  window.location.href = link(ROTAS[etapa]);
}

/** Blindagem: quem abre uma etapa protegida sem ter assinado volta para a petição. */
export function exigirAssinatura(): boolean {
  if (Estado.lead().assinou) return true;
  window.location.replace(link(ROTAS.peticao));
  return false;
}
