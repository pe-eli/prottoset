import type { ExtraItem } from '../types';

export const defaultExtras: ExtraItem[] = [
  {
    id: 'entrega-urgente',
    name: 'Entrega Urgente',
    description: 'Prioridade máxima com prazo reduzido de entrega',
    price: 800,
  },
  {
    id: 'documentacao-tecnica',
    name: 'Documentação Técnica',
    description: 'Documentação completa do sistema com diagramas e especificações',
    price: 500,
  },
  {
    id: 'codigo-fonte',
    name: 'Código Fonte Completo',
    description: 'Entrega de todo o código fonte do projeto com acesso ao repositório',
    price: 1000,
  },
  {
    id: 'deploy',
    name: 'Deploy Incluído',
    description: 'Publicação do projeto em ambiente de produção configurado',
    price: 400,
  },
  {
    id: 'suporte-pos-entrega',
    name: 'Suporte Pós-entrega',
    description: 'Suporte técnico por 30 dias após a entrega do projeto',
    price: 600,
  },
];
