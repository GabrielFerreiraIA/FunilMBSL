import type { Metadata } from 'next';
import { FunilPagina } from '@/components/FunilPagina';

export const metadata: Metadata = {
  title: 'Assinar o abaixo-assinado',
  robots: { index: false, follow: false }
};

export default function PaginaAssinar() {
  return <FunilPagina arquivo="assinar.html" etapa="assinar" />;
}

