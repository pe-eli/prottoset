import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { authAPI } from '../features/auth/auth.api';

type VerifyStatus = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [message, setMessage] = useState('Validando o link de verificação...');

  const email = useMemo(() => (params.get('email') || '').trim().toLowerCase(), [params]);
  const token = useMemo(() => (params.get('token') || '').trim(), [params]);

  useEffect(() => {
    if (!email || !token) {
      setStatus('error');
      setMessage('Link inválido. Solicite um novo e-mail de verificação.');
      return;
    }

    authAPI
      .verifyEmail(email, token)
      .then(({ data }) => {
        setStatus('success');
        setMessage(data.message || 'E-mail verificado com sucesso.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Não foi possível verificar o e-mail. Solicite um novo link.');
      });
  }, [email, token]);

  return (
    <div className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card className="text-center" gradient>
          <h1 className="text-xl font-bold text-brand-950 mb-2">Verificação de E-mail</h1>
          <p className="text-sm text-brand-500 mb-5">{message}</p>

          {status === 'loading' ? (
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
          ) : (
            <Button onClick={() => navigate('/login')}>Ir para login</Button>
          )}
        </Card>
      </div>
    </div>
  );
}
