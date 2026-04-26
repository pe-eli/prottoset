import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { useSubscription } from '../contexts/useSubscription';
import type { AuthUser } from '../features/auth/auth.api';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: AuthUser }>();
  const { subscription, loading } = useSubscription();
  const hasActiveSubscription = subscription?.status === 'active';
  const subscriptionResolved = !loading;
  const firstName = useMemo(() => user.displayName.trim().split(/\s+/)[0] || 'Usuário', [user.displayName]);

  const cards = [
    {
      path: '/leads/prospeccao',
      title: 'Prospecção',
      description: 'Pesquise empresas e gere leads com enriquecimento por IA.',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      accent: 'from-cyan-500/30 to-blue-400/10',
      requiresSubscription: false,
    },
    {
      path: '/leads/contatos',
      title: 'Contatos',
      description: 'Organize o funil e mantenha o histórico dos potenciais clientes.',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      accent: 'from-slate-500/30 to-slate-400/10',
      requiresSubscription: true,
    },
    {
      path: '/leads/disparos',
      title: 'E-mails',
      description: 'Dispare campanhas por e-mail com personalização e controle.',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      accent: 'from-fuchsia-500/30 to-rose-400/10',
      requiresSubscription: true,
    },
    {
      path: '/leads/whatsapp',
      title: 'WhatsApp',
      description: 'Envie mensagens em lote com acompanhamento em tempo real.',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
        </svg>
      ),
      accent: 'from-emerald-500/30 to-lime-400/10',
      requiresSubscription: true,
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-[1580px] space-y-8">
        <div className="text-center px-2">
          <h1 className="text-3xl md:text-4xl font-heading font-extrabold tracking-tight text-text-primary">
            Olá, {firstName}!
          </h1>
          <p className="mt-2 text-sm md:text-base text-text-muted">
            Escolha uma funcionalidade e continue de onde parou.
          </p>
        </div>

        <section className="pt-3 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-1">
            {cards.map((card) => {
              const isLocked = card.requiresSubscription && subscriptionResolved && !hasActiveSubscription;

              return (
                <div
                  key={card.path}
                  onClick={() => navigate(card.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(card.path);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="text-left"
                >
                  <Card className={`relative min-h-[240px] sm:h-[260px] p-5 transition-all duration-300 ${isLocked ? 'border-amber-400/35 bg-amber-500/10' : 'hover:border-brand-400/40 hover:shadow-lg hover:shadow-brand-500/10'}`}>
                    {isLocked && (
                      <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m6-6V9a6 6 0 10-12 0v2m12 0H6m12 0a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5a2 2 0 012-2" />
                        </svg>
                        Bloqueado
                      </div>
                    )}
                    <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-text-primary`}>
                      {card.icon}
                    </div>
                    <h2 className="text-lg font-heading font-bold text-text-primary">{card.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary break-words">{card.description}</p>
                    {isLocked ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/pricing');
                        }}
                        className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/35 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/20"
                      >
                        Ver planos
                      </button>
                    ) : (
                      <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-300">
                        <span>Acessar</span>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
