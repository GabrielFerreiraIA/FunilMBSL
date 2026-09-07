import type { Metadata } from 'next';
import { PixClient } from './PixClient';

export const metadata: Metadata = {
  title: 'Pague com Pix para confirmar sua contribuição',
  robots: { index: false, follow: false }
};

export default function PaginaPix() {
  return <PixClient />;
}
