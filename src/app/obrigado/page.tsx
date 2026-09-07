import type { Metadata } from 'next';
import { CONFIG } from '@/lib/config';
import { ObrigadoClient } from './ObrigadoClient';

export const metadata: Metadata = {
  title: `Obrigado por assinar · ${CONFIG.campanha.titulo}`,
  robots: { index: false, follow: false }
};

export default function PaginaObrigado() {
  return <ObrigadoClient />;
}
