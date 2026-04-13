import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border-light mt-auto bg-surface/50">
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-brand-300 text-center font-medium">
          Prottocode — Desenvolvimento de Sistemas
        </p>
        <div className="flex items-center gap-4 text-xs">
          <Link to="/politica-de-privacidade" className="text-brand-400 hover:text-brand-700 transition-colors">
            Política de Privacidade
          </Link>
          <Link to="/termos-de-uso" className="text-brand-400 hover:text-brand-700 transition-colors">
            Termos de Uso
          </Link>
        </div>
      </div>
    </footer>
  );
}
