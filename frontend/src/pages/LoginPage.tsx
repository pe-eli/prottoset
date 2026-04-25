import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { authAPI } from '../features/auth/auth.api';
import type { AuthUser } from '../features/auth/auth.api';

interface LoginPageProps {
  onAuthenticated: (user: AuthUser) => void;
}

interface ApiErrorPayload {
  error?: string;
}

function getApiErrorMessage(err: unknown): string | undefined {
  if (!isAxiosError<ApiErrorPayload>(err)) return undefined;
  return err.response?.data?.error;
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
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  const navigateToVerifyEmail = (targetEmail: string, verificationId?: string, cooldownSeconds = 60) => {
    const query = new URLSearchParams({
      email: targetEmail,
      cooldown: String(Math.max(0, cooldownSeconds)),
    });
    if (verificationId) query.set('verificationId', verificationId);
    navigate(`/verify-email?${query.toString()}`);
  };

  const getRetryAfterSeconds = (err: unknown): number => {
    if (!isAxiosError(err)) return 60;
    const rawHeader = err.response?.headers?.['retry-after'];
    const retryAfter = Number(rawHeader);
    return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
  };

  const handleVerifyEmailAgain = async () => {
    const targetEmail = (pendingVerificationEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      setError('Informe um e-mail válido para continuar com a verificação.');
      return;
    }

    setError(null);
    setNotice(null);
    setResendingVerification(true);

    try {
      const { data } = await authAPI.resendCode(targetEmail);
      navigateToVerifyEmail(targetEmail, data.verificationId, 60);
      return;
    } catch (err: unknown) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429) {
        navigateToVerifyEmail(targetEmail, undefined, getRetryAfterSeconds(err));
        return;
      }

      const msg = getApiErrorMessage(err);
      setError(msg || 'Não foi possível reenviar o código agora. Tente novamente em instantes.');
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPendingVerificationEmail(null);

    const sanitizedEmail = email.trim().toLowerCase();

    if (mode === 'register' && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (mode === 'register' && !acceptedTerms) {
      setError('Você precisa concordar com os Termos de Uso e Política de Privacidade.');
      return;
    }

    const sanitizedName = name.trim().replace(/\s+/g, ' ');
    if (mode === 'register' && sanitizedName.split(' ').length < 2) {
      setError('Informe nome e sobrenome para continuar.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { data } = await authAPI.login(sanitizedEmail, password);
        onAuthenticated(data.user);
      } else {
        try {
          const { data: emailCheck } = await authAPI.checkEmail(sanitizedEmail);
          if (emailCheck.exists) {
            if (emailCheck.emailVerified) {
              setError('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
            } else {
              setError('Este e-mail já possui um cadastro pendente de verificação.');
              setNotice('Você pode continuar a confirmação sem perder o progresso.');
              setPendingVerificationEmail(sanitizedEmail);
            }
            return;
          }
        } catch (checkError: unknown) {
          const status = isAxiosError(checkError) ? checkError.response?.status : undefined;
          const message = getApiErrorMessage(checkError);

          if (status === 400) {
            setError(message || 'E-mail inválido.');
            return;
          }

          setNotice('Não foi possível validar o e-mail antecipadamente. Tentando concluir o cadastro mesmo assim.');
        }

        const { data } = await authAPI.register(sanitizedEmail, password, sanitizedName, acceptedTerms);
        const verificationEmail = data.email || sanitizedEmail;
        const verificationId = data.verificationId;
        navigateToVerifyEmail(verificationEmail, verificationId, 60);
        return;
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      if (mode === 'login' && typeof msg === 'string' && msg.toLowerCase().includes('confirme seu e-mail')) {
        setError('Seu e-mail ainda está pendente de confirmação.');
        setNotice('Clique em "Verificar e-mail novamente" para receber/validar o código de 6 dígitos.');
        setPendingVerificationEmail(sanitizedEmail);
      } else {
        setError(msg || 'Credenciais inválidas ou sessão bloqueada temporariamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setNotice(null);
    setAcceptedTerms(false);
    setPendingVerificationEmail(null);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 bg-background"
      style={{
        backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(123,140,222,0.08) 0%, transparent 40%), radial-gradient(circle at 85% 10%, rgba(123,140,222,0.06) 0%, transparent 35%)',
      }}
    >
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-surface-elevated rounded-2xl border border-border-light p-6 shadow-2xl shadow-black/20">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">
              {mode === 'login' ? 'Acesso' : 'Criar Conta'}
            </p>
            <h1 className="mt-2 text-3xl font-heading font-extrabold text-text-primary">
              Clos<span className="text-brand-400">r</span>
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              {mode === 'login'
                ? 'Entre com seu e-mail e senha.'
                : 'Preencha os dados para solicitar sua conta.'}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Nome e sobrenome</label>
                <input
                  className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all duration-200"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Ex.: Ana Silva"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">E-mail</label>
              <input
                className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all duration-200"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Senha</label>
              <input
                className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all duration-200"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 10 : undefined}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-text-muted -mt-1">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="accent-brand-400"
              />
              Mostrar senha
            </label>
            {mode === 'register' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-secondary">Confirmar Senha</label>
                  <input
                    className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all duration-200"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-text-muted -mt-1">
                  <input
                    type="checkbox"
                    checked={showConfirmPassword}
                    onChange={(e) => setShowConfirmPassword(e.target.checked)}
                    className="accent-brand-400"
                  />
                  Mostrar confirmação de senha
                </label>
                <label className="flex items-start gap-2 text-xs text-text-muted leading-relaxed">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 accent-brand-400"
                    required
                  />
                  <span>
                    Concordo com os{' '}
                    <Link to="/termos-de-uso" className="text-brand-400 font-medium hover:underline">
                      Termos de Uso
                    </Link>{' '}
                    e com a{' '}
                    <Link to="/politica-de-privacidade" className="text-brand-400 font-medium hover:underline">
                      Política de Privacidade
                    </Link>
                    .
                  </span>
                </label>
              </>
            )}

            {error ? (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>
            ) : null}

            {pendingVerificationEmail ? (
              <button
                type="button"
                onClick={handleVerifyEmailAgain}
                disabled={loading || resendingVerification}
                className="w-full inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 px-5 py-2.5 text-sm border border-brand-400/40 text-brand-300 hover:bg-brand-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingVerification ? 'Preparando verificação...' : 'Verificar e-mail novamente'}
              </button>
            ) : null}

            {notice ? (
              <p className="text-sm text-mint bg-mint/10 border border-mint/20 rounded-xl px-3 py-2">{notice}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 px-5 py-2.5 text-sm bg-brand-400 text-white hover:bg-brand-500 active:scale-[0.98] shadow-md shadow-brand-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? (mode === 'login' ? 'Entrando...' : 'Verificando e criando conta...')
                : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted font-medium">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            type="button"
            onClick={() => authAPI.googleLogin()}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
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

          <p className="mt-5 text-xs text-text-muted text-center">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button type="button" onClick={switchMode} className="text-brand-400 hover:underline font-medium">
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button type="button" onClick={switchMode} className="text-brand-400 hover:underline font-medium">
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
