import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto bg-surface/50">
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-text-muted text-center font-medium">
          Closr — Plataforma de Prospecção Inteligente
        </p>
        <div className="flex items-center gap-4 text-xs">
          <Link to="/politica-de-privacidade" className="text-text-muted hover:text-brand-400 transition-colors">
            Política de Privacidade
          </Link>
          <Link to="/termos-de-uso" className="text-text-muted hover:text-brand-400 transition-colors">
            Termos de Uso
          </Link>
        </div>
      </div>
    </footer>
  );
}
