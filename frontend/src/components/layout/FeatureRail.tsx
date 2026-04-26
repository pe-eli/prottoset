import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface FeatureItem {
  path: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: ReactNode;
}

const ITEMS: FeatureItem[] = [
  {
    path: '/leads/prospeccao',
    label: 'Prospecção',
    isActive: (pathname) => pathname.startsWith('/leads/prospeccao'),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    path: '/leads/contatos',
    label: 'Contatos',
    isActive: (pathname) => pathname.startsWith('/leads/contatos'),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    path: '/leads/disparos',
    label: 'E-mails',
    isActive: (pathname) => pathname.startsWith('/leads/disparos'),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    path: '/leads/whatsapp',
    label: 'WhatsApp',
    isActive: (pathname) => pathname.startsWith('/leads/whatsapp'),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
      </svg>
    ),
  },
];

export function FeatureRail() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="fixed left-3 top-1/2 z-40 -translate-y-1/2 rounded-r-2xl rounded-l-lg border border-border-light bg-surface/90 px-2 py-3 text-text-muted shadow-2xl shadow-black/35 backdrop-blur hover:text-text-primary"
        aria-label="Mostrar menu de funcionalidades"
        title="Mostrar menu"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <aside className="fixed left-3 top-1/2 z-40 -translate-y-1/2">
      <div className="rounded-3xl border border-border-light bg-surface/90 p-2.5 shadow-2xl shadow-black/35 backdrop-blur">
        <div className="mb-1.5 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-text-muted transition-colors hover:border-border-light hover:bg-surface-elevated hover:text-text-primary"
            aria-label={collapsed ? 'Expandir menu' : 'Retrair menu'}
            title={collapsed ? 'Expandir menu' : 'Retrair menu'}
          >
            <svg
              className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-text-muted transition-colors hover:border-border-light hover:bg-surface-elevated hover:text-text-primary"
            aria-label="Esconder menu"
            title="Esconder menu"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5" />
            </svg>
          </button>
        </div>
        <nav aria-label="Navegação das funcionalidades" className="flex flex-col gap-1.5">
          {ITEMS.map((item) => {
            const active = item.isActive(location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                aria-label={item.label}
                className={`group flex ${collapsed ? 'h-10 w-10' : 'h-11 w-11'} items-center justify-center rounded-2xl border transition-all ${
                  active
                    ? 'border-brand-400/50 bg-brand-400/20 text-brand-300 shadow-lg shadow-brand-400/25'
                    : 'border-transparent bg-surface-secondary/60 text-text-muted hover:border-border-light hover:bg-surface-elevated hover:text-text-primary'
                }`}
              >
                {item.icon}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
