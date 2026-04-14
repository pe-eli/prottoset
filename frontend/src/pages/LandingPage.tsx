import React from 'react';
import { useNavigate } from 'react-router-dom';

/* ─── Icons ─── */
const ArrowRight = ({ className = '', size = 16 }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const MenuIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const XIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

/* ─── Brand Logo ─── */
const ClosrLogo = ({ className = '' }: { className?: string }) => (
  <span className={`font-heading font-extrabold tracking-tight ${className}`}>
    Clos<span className="text-brand-400">r</span>
  </span>
);

/* ─── Data ─── */
const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: 'Prospecção Automática',
    description: 'Busca leads por nicho e cidade, varrendo bairro a bairro no Google Maps. Classifica automaticamente por prioridade.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Disparo de E-mails',
    description: 'Envie e-mails em massa com templates personalizados. Acompanhe o progresso em tempo real com fila inteligente.',
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    title: 'WhatsApp com IA',
    description: 'Mensagens únicas geradas por IA para cada lote. Envio via Evolution API com intervalos inteligentes.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h18l-3 6H6L3 4zm3 6v10a2 2 0 002 2h8a2 2 0 002-2V10" />
      </svg>
    ),
    title: 'Funil Automático',
    description: 'IA conduz cada lead pelas etapas: Abordagem, Qualificação, Gancho e Demonstração — sem intervenção.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'CRM Integrado',
    description: 'Gerencie leads, acompanhe status e tenha visão clara do pipeline de vendas em um só lugar.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Orçamentos em PDF',
    description: 'Crie orçamentos profissionais e propostas por pacotes com geração automática de PDF.',
  },
];

const STEPS = [
  { number: '01', title: 'Prospecte', description: 'Busque leads por nicho e cidade. O sistema varre bairro a bairro e classifica automaticamente.' },
  { number: '02', title: 'Contate', description: 'Dispare e-mails e WhatsApp com textos gerados por IA. Cada mensagem é única.' },
  { number: '03', title: 'Automatize', description: 'O funil de vendas guia cada lead do primeiro contato até a demonstração.' },
  { number: '04', title: 'Feche', description: 'Acompanhe o pipeline, gere orçamentos em PDF e converta leads em clientes.' },
];

const STATS = [
  { value: '10x', label: 'Mais leads por hora' },
  { value: '85%', label: 'Menos trabalho manual' },
  { value: '24/7', label: 'Funil funcionando' },
  { value: '< 5min', label: 'Primeiro contato' },
];

/* ─── Navigation ─── */
const Navigation = React.memo(({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-background/90 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <ClosrLogo className="text-xl text-text-primary" />

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button onClick={() => scrollTo('features')} className="text-sm text-text-muted hover:text-text-primary transition-colors">
              Funcionalidades
            </button>
            <button onClick={() => scrollTo('como-funciona')} className="text-sm text-text-muted hover:text-text-primary transition-colors">
              Como funciona
            </button>
            <button onClick={() => scrollTo('diferenciais')} className="text-sm text-text-muted hover:text-text-primary transition-colors">
              Diferenciais
            </button>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => onNavigate('/login')}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold rounded-lg bg-brand-400 text-white hover:bg-brand-500 active:scale-95 transition-all"
            >
              Começar agora
            </button>
          </div>

          <button
            type="button"
            className="md:hidden text-text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-background backdrop-blur-md border-t border-white/[0.06]">
          <div className="px-6 py-4 flex flex-col gap-4">
            <button onClick={() => scrollTo('features')} className="text-sm text-text-muted hover:text-text-primary transition-colors py-2 text-left">
              Funcionalidades
            </button>
            <button onClick={() => scrollTo('como-funciona')} className="text-sm text-text-muted hover:text-text-primary transition-colors py-2 text-left">
              Como funciona
            </button>
            <button onClick={() => scrollTo('diferenciais')} className="text-sm text-text-muted hover:text-text-primary transition-colors py-2 text-left">
              Diferenciais
            </button>
            <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.06]">
              <button
                onClick={() => { setMobileMenuOpen(false); onNavigate('/login'); }}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold rounded-lg bg-brand-400 text-white"
              >
                Começar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});
Navigation.displayName = 'Navigation';

/* ─── Hero ─── */
const Hero = React.memo(({ onNavigate }: { onNavigate: (path: string) => void }) => (
  <section className="relative min-h-screen flex flex-col items-center justify-start px-6 pt-28 md:pt-32 pb-20">
    {/* Glow */}
    <div
      className="absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(123,140,222,0.12) 0%, transparent 70%)',
      }}
    />

    <aside className="relative z-10 mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm">
      <span className="text-xs text-text-muted">
        Prospecção + Automação + Inteligência Artificial
      </span>
      <span className="flex items-center gap-1 text-xs text-brand-400">
        Saiba mais
        <ArrowRight size={12} />
      </span>
    </aside>

    <h1
      className="relative z-10 text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-center max-w-4xl leading-tight mb-6"
      style={{
        background: 'linear-gradient(to bottom, #e8eaf0 0%, #e8eaf0 40%, rgba(232,234,240,0.5) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.04em',
      }}
    >
      Encontre clientes. <br />
      Automatize o contato. <br />
      Feche negócios.
    </h1>

    <p className="relative z-10 text-sm md:text-base text-center max-w-2xl px-4 mb-10 text-text-muted leading-relaxed">
      Plataforma completa de prospecção e gerenciamento de clientes. <br className="hidden sm:block" />
      Busca automática de leads, disparo inteligente por e-mail e WhatsApp, <br className="hidden sm:block" />
      funil de vendas com IA e CRM — tudo em um só lugar.
    </p>

    <div className="relative z-10 flex items-center gap-4 mb-20">
      <button
        onClick={() => onNavigate('/login')}
        className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-bold rounded-lg bg-brand-400 text-white hover:bg-brand-500 active:scale-95 transition-all shadow-lg shadow-brand-400/20"
      >
        Começar agora
      </button>
    </div>

    {/* Stats banner */}
    <div className="relative z-10 w-full max-w-4xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-5 text-center">
            <p className="text-2xl sm:text-3xl font-heading font-extrabold mb-1 text-brand-400">
              {stat.value}
            </p>
            <p className="text-xs text-text-muted font-medium">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
));
Hero.displayName = 'Hero';

/* ─── Features ─── */
const Features = React.memo(() => (
  <section id="features" className="relative px-6 py-24">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2
          className="text-3xl md:text-4xl font-heading font-extrabold mb-4"
          style={{
            background: 'linear-gradient(to bottom, #e8eaf0, rgba(232,234,240,0.6))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.03em',
          }}
        >
          Tudo para converter leads
        </h2>
        <p className="text-text-muted max-w-lg mx-auto">
          Da prospecção ao fechamento, cada etapa do seu processo comercial coberta por uma ferramenta dedicada.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.05] hover:border-brand-400/20 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-brand-400 mb-5 group-hover:bg-brand-400/10 group-hover:border-brand-400/20 transition-all duration-300">
              {f.icon}
            </div>
            <h3 className="text-base font-heading font-bold text-text-primary mb-2 group-hover:text-brand-300 transition-colors">{f.title}</h3>
            <p className="text-sm text-text-muted leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
));
Features.displayName = 'Features';

/* ─── Como funciona ─── */
const HowItWorks = React.memo(() => (
  <section id="como-funciona" className="relative px-6 py-24">
    {/* Subtle glow */}
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(123,140,222,0.06) 0%, transparent 70%)',
      }}
    />

    <div className="max-w-5xl mx-auto relative z-10">
      <div className="text-center mb-16">
        <h2
          className="text-3xl md:text-4xl font-heading font-extrabold mb-4"
          style={{
            background: 'linear-gradient(to bottom, #e8eaf0, rgba(232,234,240,0.6))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.03em',
          }}
        >
          Como funciona
        </h2>
        <p className="text-text-muted max-w-lg mx-auto">
          Em 4 etapas simples, transforme buscas em clientes reais.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {STEPS.map((step, i) => (
          <div key={step.number} className="relative">
            {i < STEPS.length - 1 && (
              <div className="hidden lg:block absolute top-7 left-full w-full h-px border-t border-dashed border-white/[0.08] -translate-x-4 z-0" />
            )}
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
                <span className="text-lg font-heading font-extrabold text-brand-400">
                  {step.number}
                </span>
              </div>
              <h3 className="text-base font-heading font-bold text-text-primary mb-2">{step.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
));
HowItWorks.displayName = 'HowItWorks';

/* ─── Diferenciais ─── */
const DIFFERENTIALS = [
  {
    title: 'Prospecção inteligente por localização',
    desc: 'Varre bairro a bairro usando OpenStreetMap + Google Maps. Prioriza empresas sem site — que mais precisam dos seus serviços.',
  },
  {
    title: 'IA que vende por você',
    desc: 'Mensagens de WhatsApp únicas geradas por IA. Funil automático que guia o lead do primeiro contato até a demonstração.',
  },
  {
    title: 'Multicanal: E-mail + WhatsApp',
    desc: 'Disparo em massa com validação prévia de números e acompanhamento em tempo real por ambos os canais.',
  },
  {
    title: 'Sem dependência de planilhas',
    desc: 'Pipeline visual, CRM integrado e orçamentos em PDF. Tudo no navegador, sem instalar nada.',
  },
];

const Differentials = React.memo(() => (
  <section id="diferenciais" className="relative px-6 py-24">
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div>
          <h2
            className="text-3xl md:text-4xl font-heading font-extrabold mb-4"
            style={{
              background: 'linear-gradient(to bottom, #e8eaf0, rgba(232,234,240,0.6))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.03em',
            }}
          >
            Por que Closr?
          </h2>
          <p className="text-text-muted mb-10 leading-relaxed">
            Enquanto outros CRMs focam apenas em organizar contatos, o Closr vai mais longe:
            encontra os leads por você, entra em contato automaticamente e conduz a conversa até o fechamento.
          </p>

          <div className="space-y-6">
            {DIFFERENTIALS.map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-mint/20 border border-mint/30 flex items-center justify-center">
                  <svg className="w-3 h-3 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-1">{item.title}</h4>
                  <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual orbit */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative w-80 h-80">
            <div className="absolute inset-0 rounded-full border border-dashed border-white/[0.06] animate-[spin_60s_linear_infinite]" />
            <div className="absolute inset-8 rounded-full border border-dashed border-white/[0.08] animate-[spin_45s_linear_infinite_reverse]" />
            <div className="absolute inset-16 rounded-full border border-dashed border-white/[0.05] animate-[spin_30s_linear_infinite]" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-2xl shadow-brand-400/20 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>

            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <svg className="w-4 h-4 text-mint" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
));
Differentials.displayName = 'Differentials';

/* ─── CTA ─── */
const CTA = React.memo(({ onNavigate }: { onNavigate: (path: string) => void }) => (
  <section className="px-6 py-24">
    <div className="max-w-4xl mx-auto relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 sm:p-16 text-center">
      {/* Glow spots */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(123,140,222,0.12) 0%, transparent 70%)' }} />

      <div className="relative z-10">
        <h2
          className="text-3xl sm:text-4xl font-heading font-extrabold mb-4"
          style={{
            background: 'linear-gradient(to bottom, #e8eaf0, rgba(232,234,240,0.6))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.03em',
          }}
        >
          Pronto para automatizar <br className="hidden sm:block" />
          sua prospecção?
        </h2>
        <p className="text-text-muted max-w-lg mx-auto mb-10 leading-relaxed">
          Pare de perder tempo buscando leads manualmente. Deixe o Closr encontrar,
          contatar e qualificar seus potenciais clientes enquanto você foca no que importa.
        </p>
        <button
          onClick={() => onNavigate('/login')}
          className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-bold rounded-lg bg-brand-400 text-white hover:bg-brand-500 active:scale-95 transition-all shadow-lg shadow-brand-400/20"
        >
          Acessar a Plataforma
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  </section>
));
CTA.displayName = 'CTA';

/* ─── Footer ─── */
const LandingFooter = React.memo(() => (
  <footer className="border-t border-white/[0.06] px-6 py-8">
    <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <ClosrLogo className="text-base text-text-secondary" />
      <p className="text-xs text-text-muted">
        Closr — Plataforma de Prospecção Inteligente
      </p>
    </div>
  </footer>
));
LandingFooter.displayName = 'LandingFooter';

/* ─── Main ─── */
export function LandingPage() {
  const navigate = useNavigate();
  const go = (path: string) => navigate(path);

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <Navigation onNavigate={go} />
      <Hero onNavigate={go} />
      <Features />
      <HowItWorks />
      <Differentials />
      <CTA onNavigate={go} />
      <LandingFooter />
    </main>
  );
}
