import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { authAPI } from '../features/auth/auth.api';

interface LoginPageProps {
  onAuthenticated: (username: string) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await authAPI.login(username.trim(), password);
      onAuthenticated(data.username);
    } catch {
      setError('Credenciais inválidas ou sessão bloqueada temporariamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(26,79,255,0.14)_0%,transparent_40%),radial-gradient(circle_at_85%_10%,rgba(51,112,255,0.14)_0%,transparent_35%),linear-gradient(180deg,#f4f7ff_0%,#e9f0ff_100%)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <Card className="border-brand-100 shadow-xl shadow-brand-200/30" gradient>
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">Acesso Restrito</p>
            <h1 className="mt-2 text-3xl font-bold text-brand-950">Prottoset</h1>
            <p className="mt-2 text-sm text-brand-500">Ambiente privado. Entre com seu usuário e senha.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-5 text-xs text-brand-400 text-center">
            Sem opção de cadastro. Acesso apenas ao administrador autorizado.
          </p>
        </Card>
      </div>
    </div>
  );
}
