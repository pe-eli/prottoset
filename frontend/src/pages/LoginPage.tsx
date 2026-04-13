import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { authAPI } from '../features/auth/auth.api';
import type { AuthUser } from '../features/auth/auth.api';

interface LoginPageProps {
  onAuthenticated: (user: AuthUser) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (mode === 'register' && !acceptedTerms) {
      setError('Você precisa concordar com os Termos de Uso e Política de Privacidade.');
      return;
    }

    setLoading(true);

    try {
      const sanitizedEmail = email.trim().toLowerCase();
      if (mode === 'login') {
        const { data } = await authAPI.login(sanitizedEmail, password);
        onAuthenticated(data.user);
      } else {
        const sanitizedName = name.trim().replace(/\s+/g, ' ');
        const { data } = await authAPI.register(sanitizedEmail, password, sanitizedName, acceptedTerms);
        const verificationEmail = data.email || sanitizedEmail;
        const verificationId = data.verificationId;
        const query = new URLSearchParams({ email: verificationEmail });
        if (verificationId) query.set('verificationId', verificationId);
        navigate(`/verify-email?${query.toString()}`);
        return;
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(msg || 'Credenciais inválidas ou sessão bloqueada temporariamente.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setNotice(null);
    setAcceptedTerms(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(26,79,255,0.14)_0%,transparent_40%),radial-gradient(circle_at_85%_10%,rgba(51,112,255,0.14)_0%,transparent_35%),linear-gradient(180deg,#f4f7ff_0%,#e9f0ff_100%)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <Card className="border-brand-100 shadow-xl shadow-brand-200/30" gradient>
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">
              {mode === 'login' ? 'Acesso' : 'Criar Conta'}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-brand-950">Prottoset</h1>
            <p className="mt-2 text-sm text-brand-500">
              {mode === 'login'
                ? 'Entre com seu e-mail e senha.'
                : 'Preencha os dados para solicitar sua conta.'}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <Input
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
              />
            )}
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 10 : undefined}
            />
            <label className="flex items-center gap-2 text-xs text-brand-500 -mt-1">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Mostrar senha
            </label>
            {mode === 'register' && (
              <>
                <Input
                  label="Confirmar Senha"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <label className="flex items-center gap-2 text-xs text-brand-500 -mt-1">
                  <input
                    type="checkbox"
                    checked={showConfirmPassword}
                    onChange={(e) => setShowConfirmPassword(e.target.checked)}
                  />
                  Mostrar confirmação de senha
                </label>
                <label className="flex items-start gap-2 text-xs text-brand-500 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5"
                    required
                  />
                  <span>
                    Concordo com os{' '}
                    <Link to="/termos-de-uso" className="text-brand-700 font-medium hover:underline">
                      Termos de Uso
                    </Link>{' '}
                    e com a{' '}
                    <Link to="/politica-de-privacidade" className="text-brand-700 font-medium hover:underline">
                      Política de Privacidade
                    </Link>
                    .
                  </span>
                </label>
              </>
            )}

            {error ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            ) : null}

            {notice ? (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{notice}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Entrando...' : 'Criando conta...')
                : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-brand-100" />
            <span className="text-xs text-brand-400 font-medium">ou</span>
            <div className="flex-1 h-px bg-brand-100" />
          </div>

          <button
            type="button"
            onClick={() => authAPI.googleLogin()}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-brand-200 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Entrar com Google
          </button>

          <p className="mt-5 text-xs text-brand-400 text-center">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button type="button" onClick={switchMode} className="text-brand-600 hover:underline font-medium">
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button type="button" onClick={switchMode} className="text-brand-600 hover:underline font-medium">
                  Entrar
                </button>
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
