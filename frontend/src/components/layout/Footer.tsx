import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto bg-surface/50">
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-text-muted text-center font-medium">
          Closr — Plataforma de Prospecção Inteligente
          </p>
          <div className="flex items-center gap-4 text-xs">
            <a
              href="https://wa.me/5537998409691"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/20 hover:bg-emerald-500/25 transition-colors"
            >
              Suporte
            </a>
            <Link to="/politica-de-privacidade" className="text-text-muted hover:text-brand-400 transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/termos-de-uso" className="text-text-muted hover:text-brand-400 transition-colors">
              Termos de Uso
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
          <p>Contato: <a href="mailto:prottocode@gmail.com" className="hover:text-brand-400 transition-colors">prottocode@gmail.com</a></p>
          <p className="text-center">
            Plataforma desenvolvida pela Prottocode ·
            {' '}
            <a href="https://instagram.com/prottocode" target="_blank" rel="noreferrer" className="hover:text-brand-400 transition-colors">Instagram</a>
            {' '}
            ·
            {' '}
            <a href="https://www.prottocode.com.br" target="_blank" rel="noreferrer" className="hover:text-brand-400 transition-colors">www.prottocode.com.br</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
