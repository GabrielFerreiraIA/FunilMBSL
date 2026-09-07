import { CONFIG } from '../config';

/** Quantas pessoas o valor escolhido alcança — proporcional, arredondado. */
export function alcanceDe(valor: number): number {
  const { pessoasPorReal, arredondarPara } = CONFIG.contribuicao;
  const bruto = Math.max(0, Number(valor) || 0) * pessoasPorReal;
  if (bruto <= 0) return 0;
  return Math.max(arredondarPara, Math.round(bruto / arredondarPara) * arredondarPara);
}
