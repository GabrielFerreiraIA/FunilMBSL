import type { Metadata } from 'next';
import { AdminClient } from './AdminClient';

export const metadata: Metadata = {
  title: 'Dashboard · Funil MBSL',
  robots: { index: false, follow: false }
};

export default function PaginaAdmin() {
  return <AdminClient />;
}
