import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';

const FEATURES = [
  {
    path: '/leads/prospeccao',
    title: 'Prospecção',
    description: 'Busque leads automaticamente via Google e enriqueça com IA',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    color: 'from-blue-500 to-cyan-400',
    shadowColor: 'shadow-blue-500/20',
  },
  {
    path: '/leads/contatos',
    title: 'Contatos',
    description: 'Gerencie seus potenciais clientes e acompanhe o progresso',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'from-slate-500 to-slate-400',
    shadowColor: 'shadow-slate-500/20',
  },
  {
    path: '/leads/disparos',
    title: 'Disparo de E-mails',
    description: 'Envie e-mails em massa com templates personalizados',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    color: 'from-violet-500 to-purple-400',
    shadowColor: 'shadow-violet-500/20',
  },
  {
    path: '/leads/whatsapp',
    title: 'Disparo de WhatsApp',
    description: 'Mensagens únicas geradas por IA, enviadas em lotes via Evolution API',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    color: 'from-emerald-500 to-green-400',
    shadowColor: 'shadow-emerald-500/20',
  },
];

export function LeadsHub() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Hero section */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-400/10 text-brand-400 text-xs font-semibold mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Central de Leads
        </div>
        <h1 className="text-3xl font-heading font-extrabold text-text-primary mb-2">
          Gerencie seus <span className="gradient-text">leads</span> de ponta a ponta
        </h1>
        <p className="text-text-muted text-sm max-w-md mx-auto">
          Prospecte, entre em contato e acompanhe o progresso de cada potencial cliente.
        </p>
      </div>

      {/* Feature cards */}
      <div className="flex justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 w-full max-w-2xl gap-6">
          {FEATURES.map((feature) => (
            <Link key={feature.path} to={feature.path}>
              <Card hover className="h-full group">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white shadow-lg ${feature.shadowColor} mb-5 group-hover:scale-105 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-heading font-bold text-text-primary mb-1.5 group-hover:text-brand-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-brand-400 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span>Acessar</span>
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
