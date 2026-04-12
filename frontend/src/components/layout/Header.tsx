import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authAPI } from '../../features/auth/auth.api';
import type { AuthUser } from '../../features/auth/auth.api';

const NAV_ITEMS = [
  { path: '/home', label: 'Orcamentos' },
  { path: '/leads', label: 'Leads' },
  { path: '/produtividade', label: 'Produtividade' },
];

interface HeaderProps {
  user: AuthUser;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } finally {
      onLogout();
    }
  };

  const initials = user.displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 glass border-b border-border-light">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="Prottocode" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-base font-bold text-brand-950 tracking-tight group-hover:text-brand-700 transition-colors">
                PROTTOCODE
              </h1>
              <p className="text-[10px] text-brand-400 font-medium -mt-0.5">Gestao de Negocios</p>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.path === '/home'
                  ? location.pathname === '/home' || location.pathname === '/novo' || location.pathname === '/pacotes'
                  : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm px-4 py-2 rounded-xl transition-all duration-200 font-medium ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 shadow-sm'
                      : 'text-brand-400 hover:text-brand-600 hover:bg-brand-50/50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-brand-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <span className="hidden sm:block text-sm font-medium text-brand-700 max-w-[120px] truncate">
              {user.displayName}
            </span>
            <svg
              className={`w-4 h-4 text-brand-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-border-light shadow-lg z-50 py-1.5 animate-fade-in">
                <div className="px-4 py-2.5 border-b border-border-light">
                  <p className="text-sm font-medium text-brand-950 truncate">{user.displayName}</p>
                  <p className="text-xs text-brand-400 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
