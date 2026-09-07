import type { Metadata } from 'next';
import { FunilPagina } from '@/components/FunilPagina';
import { CONFIG } from '@/lib/config';

export const metadata: Metadata = {
  title: `Compartilhar abaixo-assinado · ${CONFIG.campanha.titulo}`,
  robots: { index: false, follow: false }
};

export default function PaginaCompartilhar() {
  return <FunilPagina arquivo="compartilhar.html" etapa="compartilhar" />;
}
