import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Orçamentos' },
  { path: '/leads', label: 'Leads' },
];

export function Header() {
  const location = useLocation();

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
              <p className="text-[10px] text-brand-400 font-medium -mt-0.5">Gestão de Negócios</p>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.path === '/'
                  ? location.pathname === '/' || location.pathname === '/novo' || location.pathname === '/pacotes'
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
      </div>
    </header>
  );
}
