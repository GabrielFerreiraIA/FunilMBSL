import type { Metadata } from 'next';
import { FunilPagina } from '@/components/FunilPagina';
import { CONFIG } from '@/lib/config';

export const metadata: Metadata = {
  title: `Abaixo-assinado · ${CONFIG.campanha.titulo}`,
  description:
    'Assine o abaixo-assinado pelo impeachment do Ministro Alexandre de Moraes. Mais de 1,8 milhão de assinaturas verificadas.'
};

export default function PaginaPeticao() {
  return <FunilPagina arquivo="peticao.html" etapa="peticao" />;
}
