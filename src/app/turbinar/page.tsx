import type { Metadata } from 'next';
import { FunilPagina } from '@/components/FunilPagina';
import { CONFIG } from '@/lib/config';

export const metadata: Metadata = {
  title: `Turbine · ${CONFIG.campanha.titulo}`,
  robots: { index: false, follow: false }
};

export default function PaginaTurbinar() {
  return <FunilPagina arquivo="turbinar.html" etapa="turbinar" />;
}
