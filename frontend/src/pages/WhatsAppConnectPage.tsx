import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { waInstanceAPI } from '../features/whatsapp/wa-instance.api';
import type { WaInstanceStatus } from '../features/whatsapp/wa-instance.api';

function WaIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function WhatsAppConnectPage() {
  const [status, setStatus] = useState<WaInstanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await waInstanceAPI.getStatus();
      setStatus(data);
      if (data.status === 'connected') {
        setQrCode(null);
        stopPolling();
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (data?.status === 'connected') {
        stopPolling();
      }
    }, 3000);
  }

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
    return () => stopPolling();
  }, [fetchStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { data } = await waInstanceAPI.connect();
      if (data.status === 'already_connected') {
        await fetchStatus();
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
        setStatus((prev) => prev ? { ...prev, status: 'connecting' } : prev);
        startPolling();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar';
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await waInstanceAPI.disconnect();
      setStatus((prev) => prev ? { ...prev, status: 'disconnected', phone: null } : prev);
      setQrCode(null);
      stopPolling();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desconectar';
      setError(msg);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-border border-t-emerald-400 animate-spin" />
        </div>
      </div>
    );
  }

  const isConnected = status?.status === 'connected';
  const isConnecting = status?.status === 'connecting';

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/leads/whatsapp" className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Conexão WhatsApp</h2>
          <p className="text-sm text-text-secondary">Conecte seu WhatsApp para enviar mensagens</p>
        </div>
      </div>

      {/* Status card */}
      <Card gradient>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
            isConnected
              ? 'bg-gradient-to-br from-emerald-500 to-green-400 shadow-emerald-500/20'
              : 'bg-gradient-to-br from-slate-500 to-slate-400 shadow-slate-500/20'
          }`}>
            <WaIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-text-primary">
                {isConnected ? 'Conectado' : isConnecting ? 'Aguardando conexao...' : 'Desconectado'}
              </h3>
              <span className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
              }`} />
            </div>
            {isConnected && status?.phone && (
              <p className="text-sm text-emerald-400 font-medium mt-0.5">
                +{status.phone}
              </p>
            )}
            {!isConnected && !isConnecting && (
              <p className="text-sm text-text-muted mt-0.5">
                Escaneie o QR Code para conectar
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* QR Code card */}
      {!isConnected && (
        <Card>
          {qrCode ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-text-primary mb-1">Escaneie o QR Code</p>
                <p className="text-xs text-text-muted">
                  Abra o WhatsApp no celular &rarr; Dispositivos conectados &rarr; Conectar dispositivo
                </p>
              </div>
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl shadow-lg shadow-black/20">
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                <svg className="w-3.5 h-3.5 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Aguardando leitura do QR Code...
              </div>
              <div className="text-center">
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  QR expirou? Gerar novo
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <WaIcon className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Conecte seu WhatsApp</p>
                <p className="text-xs text-text-muted mt-1">
                  Um QR Code será gerado para você escanear com seu celular
                </p>
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Gerando QR Code...
                  </>
                ) : (
                  <>
                    <WaIcon className="w-4 h-4" />
                    Conectar WhatsApp
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Connected — actions */}
      {isConnected && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">WhatsApp pronto para uso</p>
              <p className="text-xs text-text-muted mt-0.5">
                Voce pode enviar mensagens em massa pela pagina de disparos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/leads/whatsapp">
                <Button size="sm">
                  <WaIcon className="w-3.5 h-3.5" />
                  Ir para disparos
                </Button>
              </Link>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-400/20 rounded-2xl animate-fade-in">
          <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-xs font-bold text-red-400">Erro</p>
            <p className="text-xs text-red-300 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Info */}
      <Card>
        <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3">Como funciona</h3>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Clique em "Conectar WhatsApp" para gerar o QR Code' },
            { step: '2', text: 'Abra o WhatsApp no celular e escaneie o código' },
            { step: '3', text: 'Pronto! Sua instância ficará salva e conectada' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-lg bg-brand-400/10 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0">
                {item.step}
              </span>
              <p className="text-sm text-text-secondary">{item.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
