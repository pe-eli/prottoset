import type { ServiceItem } from '../types';

export const defaultServices: ServiceItem[] = [
  {
    id: 'prototipo-sistema',
    name: 'Protótipo de Sistema',
    description: 'Protótipo interativo completo com navegação e fluxos principais',
    basePrice: 3000,
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Página de captura ou institucional com design responsivo',
    basePrice: 1500,
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Painel administrativo com gráficos, tabelas e métricas',
    basePrice: 2500,
  },
  {
    id: 'sistema-web-completo',
    name: 'Sistema Web Completo',
    description: 'Aplicação web full-stack com frontend, backend e banco de dados',
    basePrice: 8000,
  },
  {
    id: 'integracao-api',
    name: 'Integração com API',
    description: 'Desenvolvimento e integração com APIs externas ou internas',
    basePrice: 2000,
  },
  {
    id: 'ui-ux-design',
    name: 'UI/UX Design',
    description: 'Design de interfaces e experiência do usuário completa',
    basePrice: 1800,
  },
];
