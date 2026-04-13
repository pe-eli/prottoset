import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { authAPI } from '../features/auth/auth.api';

const RESEND_COOLDOWN = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.length <= 2 ? '*'.repeat(local.length) : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

type VerifyStatus = 'idle' | 'success' | 'error';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = useMemo(() => (params.get('email') || '').trim().toLowerCase(), [params]);
  const initialVerificationId = useMemo(() => (params.get('verificationId') || '').trim(), [params]);

  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState(initialVerificationId);

  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Start cooldown on mount (user just registered, code was already sent)
  useEffect(() => {
    if (email) startCooldown();
  }, [email, startCooldown]);

  if (!email) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-md">
          <Card className="text-center" gradient>
            <h1 className="text-xl font-bold text-brand-950 mb-2">Verificação de e-mail</h1>
            <p className="text-sm text-brand-500 mb-5">
              Nenhum e-mail informado. Volte para o cadastro e tente novamente.
            </p>
            <Link to="/login" className="text-sm text-brand-700 hover:underline">
              Voltar para o cadastro
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const submitVerification = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

    if (!verificationId) {
      setStatus('error');
      setErrorMessage('Solicite um novo código antes de validar.');
      return;
    }

    if (normalizedCode.length !== 6) {
      setStatus('error');
      setErrorMessage('Digite o código com 6 dígitos.');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      await authAPI.verifyCode(email, normalizedCode, verificationId);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.response?.data?.error || 'Código inválido ou expirado. Solicite um novo código.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (cooldown > 0) return;

    setStatus('idle');
    setErrorMessage('');
    startCooldown();

    try {
      const { data } = await authAPI.resendCode(email);
      if (data.verificationId) {
        setVerificationId(data.verificationId);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.response?.data?.error || 'Não foi possível reenviar o código agora.');
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card className="text-center" gradient>
          <h1 className="text-xl font-bold text-brand-950 mb-2">Confirmar e-mail</h1>

          {status === 'success' ? (
            <>
              <p className="text-sm text-green-600 mb-5">E-mail verificado com sucesso!</p>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Ir para login
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-brand-500 mb-1">
                Um código de verificação foi enviado para o e-mail <strong>{maskEmail(email)}</strong>.
              </p>
              <p className="text-xs text-brand-400 mb-5">Verifique também a caixa de spam.</p>

              {status === 'error' && errorMessage && (
                <p className="text-sm text-red-600 mb-3">{errorMessage}</p>
              )}

              <form className="space-y-3 text-left" onSubmit={submitVerification}>
                <Input
                  label="Código (6 dígitos)"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  required
                />

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Validando...' : 'Verificar código'}
                </Button>
              </form>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={cooldown > 0}
                  className="text-sm text-brand-700 hover:underline disabled:opacity-60 disabled:no-underline disabled:cursor-default"
                >
                  {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
