import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { authAPI } from '../features/auth/auth.api';

type VerifyStatus = 'idle' | 'success' | 'error';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('Digite o código de 6 dígitos enviado para seu e-mail.');

  const initialEmail = useMemo(() => (params.get('email') || '').trim().toLowerCase(), [params]);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');

  const submitVerification = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

    if (!normalizedEmail || normalizedCode.length !== 6) {
      setStatus('error');
      setMessage('Preencha e-mail e código com 6 dígitos.');
      return;
    }

    setLoading(true);
    setStatus('idle');

    try {
      const { data } = await authAPI.verifyCode(normalizedEmail, normalizedCode);
      setStatus('success');
      setMessage(data.message || 'E-mail verificado com sucesso.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.response?.data?.error || 'Código inválido ou expirado. Solicite um novo código.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus('error');
      setMessage('Informe seu e-mail para reenviar o código.');
      return;
    }

    setResending(true);
    try {
      const { data } = await authAPI.resendCode(normalizedEmail);
      setStatus('idle');
      setMessage(data.message || 'Se existir uma conta pendente, um novo código será enviado.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.response?.data?.error || 'Não foi possível reenviar o código agora.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card className="text-center" gradient>
          <h1 className="text-xl font-bold text-brand-950 mb-2">Confirmar e-mail</h1>
          <p className="text-sm text-brand-500 mb-5">{message}</p>

          <form className="space-y-3 text-left" onSubmit={submitVerification}>
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="Código (6 dígitos)"
              inputMode="numeric"
              pattern="\\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Validando...' : 'Verificar código'}
            </Button>
          </form>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={resendCode}
              disabled={resending}
              className="text-sm text-brand-700 hover:underline disabled:opacity-60"
            >
              {resending ? 'Reenviando código...' : 'Reenviar código'}
            </button>
            {status === 'success' ? <Button onClick={() => navigate('/login')}>Ir para login</Button> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
