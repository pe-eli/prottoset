import { Link } from 'react-router-dom';

export function DesktopRequiredPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 bg-background"
      style={{
        backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(123,140,222,0.08) 0%, transparent 40%), radial-gradient(circle at 85% 10%, rgba(123,140,222,0.06) 0%, transparent 35%)',
      }}
    >
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-surface-elevated rounded-2xl border border-border-light p-6 shadow-2xl shadow-black/20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">Continue no PC</p>
          <h1 className="mt-2 text-3xl font-heading font-extrabold text-text-primary">
            Clos<span className="text-brand-400">r</span>
          </h1>
          <p className="mt-4 text-sm text-text-secondary">
            Para seguir com o cadastro e acessar a plataforma, continue em um computador.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            A experiência de login e operação do Closr foi liberada apenas para desktop.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 px-5 py-2.5 text-sm border border-brand-400/40 text-brand-300 hover:bg-brand-400/10"
            >
              Voltar para a landing page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}