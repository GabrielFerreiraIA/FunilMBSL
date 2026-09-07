import type { Metadata } from 'next';
import { FunilPagina } from '@/components/FunilPagina';

export const metadata: Metadata = {
  title: 'Complete seus dados - Petição',
  robots: { index: false, follow: false }
};

export default function PaginaCheckout() {
  return <FunilPagina arquivo="checkout.html" etapa="checkout" />;
}
