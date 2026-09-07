import type { Metadata } from 'next';
import { FunilPagina } from '@/components/FunilPagina';

export const metadata: Metadata = {
  title: 'Contribuir com o abaixo-assinado',
  robots: { index: false, follow: false }
};

export default function PaginaPagamento() {
  return <FunilPagina arquivo="pagamento.html" etapa="pagamento" />;
}
