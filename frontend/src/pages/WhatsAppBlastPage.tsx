import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { whatsappAPI } from '../features/whatsapp/whatsapp.api';
import { conversationsAPI } from '../features/conversations/conversations.api';
import { queuesAPI } from '../features/queues/queues.api';
import type { PhoneQueue } from '../features/queues/queues.types';
import { QueueManagerModal } from '../features/queues/QueueManagerModal';
import { useWaBlast } from '../contexts/WaBlastContext';

type BlastMode = 'direct' | 'funnel';
type JobStatus = 'pending' | 'sending' | 'sent' | 'failed';

interface QueueJob { phone: string; status: JobStatus; error?: string }
interface BlastSummary { sent: number; failed: number; total: number }
interface Countdown { remaining: number; total: number }
interface BatchInfo { current: number; total: number; count: number }

const STATUS_STYLE: Record<JobStatus, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  pending: {
    bg: 'bg-brand-50 border-brand-100', text: 'text-brand-400', label: 'Aguardando',
    icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  sending: {
    bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600', label: 'Enviando',
    icon: <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>,
  },
  sent: {
    bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600', label: 'Enviado',
    icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>,
  },
  failed: {
    bg: 'bg-red-50 border-red-200', text: 'text-red-500', label: 'Falhou',
    icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  },
};

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}

function isValidPhone(p: string): boolean {
  return p.replace(/\D/g, '').length >= 8;
}

function SparkleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
      <path opacity="0.5" d="M19 14l1.09 3.26L23 18l-2.91.74L19 22l-1.09-3.26L15 18l2.91-.74L19 14zM5 2l.73 2.18L8 5l-2.27.82L5 8l-.73-2.18L2 5l2.27-.82L5 2z" />
    </svg>
  );
}

function WaIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ChatIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

export function WhatsAppBlastPage() {
  const [mode, setMode] = useState<BlastMode>('direct');
  const [phoneInput, setPhoneInput] = useState('');
  const [phones, setPhones] = useState<string[]>([]);
  const [promptBase, setPromptBase] = useState('');

  const [batchSize, setBatchSize] = useState(5);
  const [intervalMin, setIntervalMin] = useState(15);
  const [intervalMax, setIntervalMax] = useState(45);

  const [phase, setPhase] = useState<'compose' | 'active' | 'done'>('compose');
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [summary, setSummary] = useState<BlastSummary | null>(null);
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<{ batchSize: number }>({ batchSize: 5 });
  const [batchMessages, setBatchMessages] = useState<Array<{ batch: number; message: string }>>([]);

  const [phoneQueues, setPhoneQueues] = useState<PhoneQueue[]>([]);
  const [showQueuePicker, setShowQueuePicker] = useState(false);
  const [showQueueManager, setShowQueueManager] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Funnel-specific state
  const [funnelSummary, setFunnelSummary] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: number; invalid: number } | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const blastIdRef = useRef<string | null>(null);
  const reconnectedRef = useRef(false);

  const { active: globalActive, setActive: setGlobalActive, updateProgress, clearActive } = useWaBlast();

  useEffect(() => { return () => { esRef.current?.close(); }; }, []);

  useEffect(() => {
    queuesAPI.getAll().then(({ data }) => setPhoneQueues(data)).catch(() => {});
  }, []);

  const totalBatches = Math.ceil(phones.length / batchSize);

  const addPhones = () => {
    const parsed = phoneInput.split(/[\n,;]+/).map((p) => p.trim()).filter(isValidPhone);
    setPhones((prev) => [...new Set([...prev, ...parsed])]);
    setPhoneInput('');
  };

  const removePhone = (p: string) => setPhones((prev) => prev.filter((x) => x !== p));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addPhones(); }
  };

  /* ─── Direct blast SSE ─── */
  const connectToBlast = useCallback((blastId: string) => {
    blastIdRef.current = blastId;
    esRef.current?.close();
    const es = new EventSource(whatsappAPI.blastStreamUrl(blastId));
    esRef.current = es;

    es.addEventListener('config', (e) => {
      const cfg = JSON.parse(e.data) as { batchSize: number };
      setConfigSnapshot({ batchSize: cfg.batchSize });
    });

    es.addEventListener('catchup', (e) => {
      const jobs: Array<{ phone: string; status: JobStatus; error?: string }> = JSON.parse(e.data);
      const restored = jobs.map((j) => ({ phone: j.phone, status: j.status, error: j.error }));
      setQueue(restored);
      // Sync context immediately so notification shows correct values
      const sent = restored.filter((j) => j.status === 'sent').length;
      if (restored.length > 0) updateProgress(sent, restored.length, 'sending');
    });

    es.addEventListener('batch_generating', (e) => {
      const info = JSON.parse(e.data) as { batch: number; totalBatches: number; count: number };
      setBatchInfo({ current: info.batch, total: info.totalBatches, count: info.count });
      setBatchGenerating(true);
      setCountdown(null);
      setGenError(null);
    });

    es.addEventListener('batch_start', (e) => {
      const info = JSON.parse(e.data) as { batch: number; totalBatches: number; count: number };
      setBatchInfo({ current: info.batch, total: info.totalBatches, count: info.count });
      setBatchGenerating(false);
    });

    es.addEventListener('batch_message', (e) => {
      const { batch, message } = JSON.parse(e.data) as { batch: number; message: string };
      setBatchMessages((prev) => [...prev, { batch, message }]);
    });

    es.addEventListener('gen_error', (e) => {
      const { error } = JSON.parse(e.data) as { error: string };
      setGenError(error);
      setBatchGenerating(false);
    });

    es.addEventListener('progress', (e) => {
      const { phone, status, error } = JSON.parse(e.data) as { phone: string; status: JobStatus; error?: string };
      // Pure updater — no side effects inside
      setQueue((prev) => prev.map((j) => (j.phone === phone ? { ...j, status, error } : j)));
    });

    es.addEventListener('tick', (e) => {
      const { remaining, total } = JSON.parse(e.data) as { remaining: number; total: number };
      setCountdown({ remaining, total });
    });

    const finalize = (d: BlastSummary) => {
      setSummary(d);
      setCountdown(null);
      setBatchGenerating(false);
      setCancelling(false);
      setPhase('done');
      clearActive();
      es.close();
      esRef.current = null;
    };

    es.addEventListener('done', (e) => finalize(JSON.parse(e.data)));
    es.addEventListener('cancelled', (e) => finalize(JSON.parse(e.data)));

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        // Server rejected permanently (404 — backend restarted, blastId gone)
        setPhase('compose');
        setCancelling(false);
        clearActive();
        setQueue([]);
        es.close();
        esRef.current = null;
        return;
      }
      // Transient error — let EventSource auto-reconnect
    };
  }, [clearActive, updateProgress]);

  /* ─── Funnel blast SSE ─── */
  const connectToFunnelBlast = useCallback((blastId: string) => {
    blastIdRef.current = blastId;
    esRef.current?.close();
    const es = new EventSource(conversationsAPI.startStreamUrl(blastId));
    esRef.current = es;

    // Validation events
    es.addEventListener('validating', () => {
      setValidating(true);
    });

    es.addEventListener('validated', (e) => {
      const data = JSON.parse(e.data) as { valid: number; invalid: number; total: number };
      setValidating(false);
      setValidationResult({ valid: data.valid, invalid: data.invalid });
    });

    const applyProgress = (phone: string, status: 'sent' | 'failed' | 'skipped', error?: string) => {
      const jobStatus: JobStatus = status === 'skipped' ? 'failed' : status;
      setQueue((prev) =>
        prev.map((j) =>
          j.phone === phone
            ? { ...j, status: jobStatus, error: status === 'skipped' ? 'Conversa já existe' : error }
            : j,
        ),
      );
    };

    // Replay buffered events from before SSE was connected
    es.addEventListener('catchup', (e) => {
      const { events } = JSON.parse(e.data) as {
        events: Array<{ event: string; data: { phone: string; status: 'sent' | 'failed' | 'skipped'; error?: string; remaining?: number; total?: number } }>;
        total: number; sent: number; failed: number;
      };
      for (const { event, data } of events) {
        if (event === 'progress' && data.phone) {
          applyProgress(data.phone, data.status, data.error);
        }
      }
    });

    es.addEventListener('progress', (e) => {
      const { phone, status, error } = JSON.parse(e.data) as { phone: string; status: 'sent' | 'failed' | 'skipped'; error?: string };
      applyProgress(phone, status, error);
    });

    es.addEventListener('tick', (e) => {
      const { remaining, total } = JSON.parse(e.data) as { remaining: number; total: number };
      setCountdown({ remaining, total });
    });

    es.addEventListener('cancelled', (e) => {
      const data = JSON.parse(e.data) as { sent: number; failed: number; total: number };
      setFunnelSummary({ ...data, skipped: 0 });
      setCountdown(null);
      setPhase('done');
      clearActive();
      setCancelling(false);
      es.close();
      esRef.current = null;
    });

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data) as { sent: number; failed: number; skipped: number; total: number };
      setFunnelSummary(data);
      setCountdown(null);
      setPhase('done');
      clearActive();
      es.close();
      esRef.current = null;
    });

    es.onerror = () => {
      // readyState CLOSED = server rejected permanently (404, wrong content-type)
      // This happens when backend restarted and blastId no longer exists
      if (es.readyState === EventSource.CLOSED) {
        console.log('[Funnel SSE] Connection permanently rejected — clearing stale state');
        setPhase('compose');
        clearActive();
        setCancelling(false);
        setQueue([]);
        es.close();
        esRef.current = null;
        return;
      }
      // Transient error — EventSource reconnects automatically
    };
  }, [clearActive]);

  // Sync queue changes to global context (avoids calling updateProgress inside setQueue updater)
  useEffect(() => {
    if (phase !== 'active' || queue.length === 0) return;
    const sent = queue.filter((j) => j.status === 'sent').length;
    updateProgress(sent, queue.length, 'sending');
  }, [queue, phase, updateProgress]);

  useEffect(() => {
    if (reconnectedRef.current || !globalActive || globalActive.phase !== 'sending' || esRef.current) return;
    reconnectedRef.current = true;
    setMode(globalActive.mode);
    setPhase('active');
    if (globalActive.mode === 'funnel') {
      connectToFunnelBlast(globalActive.blastId);
    } else {
      connectToBlast(globalActive.blastId);
    }
  }, [globalActive, connectToBlast, connectToFunnelBlast]);

  const handleSend = async () => {
    if (phones.length === 0 || !promptBase.trim()) return;
    setStarting(true);
    try {
      if (mode === 'funnel') {
        const { data } = await conversationsAPI.startConversations(phones, promptBase, {
          intervalMinSeconds: intervalMin,
          intervalMaxSeconds: intervalMax,
        });
        const { blastId } = data;
        // Normalize phones to match backend format (with 55 prefix)
        const normalized = phones.map((p) => {
          const clean = p.replace(/\D/g, '');
          return clean.startsWith('55') ? clean : '55' + clean;
        });
        setQueue(normalized.map((phone) => ({ phone, status: 'pending' })));
        setPhase('active');
        setPhones([]);
        setGlobalActive(blastId, data.total, 'funnel');
        connectToFunnelBlast(blastId);
      } else {
        const { data } = await whatsappAPI.startBlast(phones, promptBase, { batchSize, intervalMinSeconds: intervalMin, intervalMaxSeconds: intervalMax });
        const { blastId } = data;
        setQueue(phones.map((phone) => ({ phone, status: 'pending' })));
        setConfigSnapshot({ batchSize });
        setPhase('active');
        setPhones([]);
        setGlobalActive(blastId, data.total, 'direct');
        connectToBlast(blastId);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao iniciar disparo');
    } finally {
      setStarting(false);
    }
  };

  const handleReset = () => {
    esRef.current?.close();
    esRef.current = null;
    blastIdRef.current = null;
    reconnectedRef.current = false;
    clearActive();
    setPhase('compose');
    setQueue([]);
    setSummary(null);
    setFunnelSummary(null);
    setValidating(false);
    setValidationResult(null);
    setCountdown(null);
    setBatchInfo(null);
    setBatchGenerating(false);
    setGenError(null);
    setBatchMessages([]);
    setCancelling(false);
  };

  const handleCancel = async () => {
    console.log('[Cancel] clicked', { blastId: blastIdRef.current, cancelling, mode });
    if (!blastIdRef.current || cancelling) {
      console.log('[Cancel] early return', { blastId: blastIdRef.current, cancelling });
      return;
    }
    setCancelling(true);
    try {
      if (mode === 'funnel') {
        console.log('[Cancel] calling conversationsAPI.cancelBlast', blastIdRef.current);
        await conversationsAPI.cancelBlast(blastIdRef.current);
      } else {
        console.log('[Cancel] calling whatsappAPI.cancelBlast', blastIdRef.current);
        await whatsappAPI.cancelBlast(blastIdRef.current);
      }
      console.log('[Cancel] API success, finalizing');
      // Finaliza imediatamente — não espera o SSE 'cancelled' (pode sofrer buffering)
      const sent = queue.filter((j) => j.status === 'sent').length;
      const failed = queue.filter((j) => j.status === 'failed').length;
      esRef.current?.close();
      esRef.current = null;
      if (mode === 'funnel') {
        setFunnelSummary({ sent, failed, skipped: 0, total: queue.length });
      } else {
        setSummary({ sent, failed, total: queue.length });
      }
      setCountdown(null);
      setBatchGenerating(false);
      setPhase('done');
      clearActive();
      setCancelling(false);
    } catch (err: any) {
      console.error('[Cancel] error:', err.response?.status, err.response?.data || err.message);
      // If 404 — blast no longer exists (backend restarted) — clear everything
      if (err.response?.status === 404) {
        esRef.current?.close();
        esRef.current = null;
        setPhase('compose');
        clearActive();
        setQueue([]);
      }
      setCancelling(false);
    }
  };

  const sentCount = queue.filter((j) => j.status === 'sent').length;
  const doneCount = queue.filter((j) => j.status === 'sent' || j.status === 'failed').length;
  const progress = queue.length > 0 ? Math.round((doneCount / queue.length) * 100) : 0;
  const countdownPct = countdown ? (countdown.remaining / countdown.total) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/leads" className="w-9 h-9 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-950">Disparo de WhatsApp</h2>
          <p className="text-sm text-brand-400">
            {mode === 'direct'
              ? 'Mensagem nova gerada pela IA a cada lote — enviada via Evolution API'
              : 'Abordagem casual + funil automático de vendas com IA'}
          </p>
        </div>
      </div>

      {/* ─── COMPOSE ─── */}
      {phase === 'compose' && (
        <>
          {/* Mode selector */}
          <Card>
            <h3 className="text-sm font-bold text-brand-950 mb-3">Modo de envio</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('direct')}
                className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all duration-200 ${
                  mode === 'direct'
                    ? 'border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100'
                    : 'border-border-light bg-surface-secondary hover:bg-brand-50 hover:border-brand-200'
                }`}
              >
                {mode === 'direct' && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  mode === 'direct' ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-50 text-brand-400'
                }`}>
                  <WaIcon className="w-5 h-5" />
                </div>
                <span className={`text-sm font-semibold ${mode === 'direct' ? 'text-emerald-700' : 'text-brand-700'}`}>
                  Disparo direto
                </span>
                <span className={`text-[11px] leading-tight text-center ${mode === 'direct' ? 'text-emerald-500' : 'text-brand-400'}`}>
                  IA gera mensagem por lote e envia
                </span>
              </button>

              <button
                onClick={() => setMode('funnel')}
                className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all duration-200 ${
                  mode === 'funnel'
                    ? 'border-violet-400 bg-violet-50 shadow-sm shadow-violet-100'
                    : 'border-border-light bg-surface-secondary hover:bg-brand-50 hover:border-brand-200'
                }`}
              >
                {mode === 'funnel' && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  mode === 'funnel' ? 'bg-violet-100 text-violet-600' : 'bg-brand-50 text-brand-400'
                }`}>
                  <ChatIcon className="w-5 h-5" />
                </div>
                <span className={`text-sm font-semibold ${mode === 'funnel' ? 'text-violet-700' : 'text-brand-700'}`}>
                  Iniciar conversa
                </span>
                <span className={`text-[11px] leading-tight text-center ${mode === 'funnel' ? 'text-violet-500' : 'text-brand-400'}`}>
                  Abordagem casual + funil automático
                </span>
              </button>
            </div>
          </Card>

          {/* Destinatários */}
          <Card gradient>
            <h3 className="text-sm font-bold text-brand-950 mb-1">Destinatários</h3>
            <p className="text-xs text-brand-400 mb-4">
              Cole ou digite números separados por vírgula, ponto-e-vírgula ou quebra de linha
            </p>

            {/* Queue import */}
            {phoneQueues.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setShowQueuePicker(!showQueuePicker)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100
                      text-brand-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Importar de fila
                    <svg className={`w-3 h-3 transition-transform ${showQueuePicker ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showQueuePicker && (
                    <button
                      onClick={() => setShowQueueManager(true)}
                      className="text-[11px] text-brand-400 hover:text-brand-600 font-medium transition-colors"
                    >
                      Gerenciar filas
                    </button>
                  )}
                </div>

                {showQueuePicker && (
                  <div className="flex flex-wrap gap-2 p-3 bg-surface-secondary rounded-xl border border-border-light animate-fade-in">
                    {phoneQueues.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => {
                          setPhones((prev) => [...new Set([...prev, ...q.phones])]);
                          setShowQueuePicker(false);
                        }}
                        disabled={q.phones.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-brand-50
                          rounded-xl border border-border-light text-sm font-medium text-brand-950
                          transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span>{q.name}</span>
                        <span className="text-[10px] text-brand-300 bg-brand-50 px-1.5 py-0.5 rounded-md">
                          {q.phones.length} {q.phones.length === 1 ? 'num' : 'nums'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

              </div>
            )}

            <div className="flex gap-2">
              <textarea
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="+55 11 99999-0000, 11988880000..."
                rows={3}
                className="flex-1 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950
                  placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
                  focus:bg-white transition-all duration-200 resize-none"
              />
              <Button onClick={addPhones} variant="secondary" className="self-end">Adicionar</Button>
            </div>

            {phones.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-brand-400">
                    {phones.length} {phones.length === 1 ? 'número' : 'números'}
                  </p>
                  <button onClick={() => setPhones([])} className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium">
                    Limpar todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-3 bg-surface-secondary rounded-xl border border-border-light">
                  {phones.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200">
                      <WaIcon className="w-3 h-3 text-emerald-500" />
                      {p}
                      <button onClick={() => removePhone(p)} className="w-4 h-4 rounded-full bg-emerald-100 hover:bg-red-200 flex items-center justify-center transition-colors">
                        <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Prompt de IA */}
          <Card>
            <div className="flex items-start gap-2 mb-4">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                mode === 'funnel' ? 'bg-violet-50' : 'bg-violet-50'
              }`}>
                <SparkleIcon className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-950">
                  {mode === 'funnel' ? 'Contexto do Negócio' : 'Prompt da Mensagem'}
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-[10px] font-semibold border border-violet-100">
                    <SparkleIcon className="w-2.5 h-2.5" />
                    DeepSeek AI
                  </span>
                </h3>
                <p className="text-xs text-brand-400 mt-0.5">
                  {mode === 'funnel'
                    ? 'Descreva seu negócio e serviços. A IA usará isso para conduzir as conversas pelo funil de vendas automaticamente.'
                    : 'Descreva a intenção da mensagem. A IA cria um texto diferente antes de cada lote — nunca envia este campo diretamente.'}
                </p>
              </div>
            </div>
            <textarea
              value={promptBase}
              onChange={(e) => setPromptBase(e.target.value)}
              placeholder={mode === 'funnel'
                ? 'Ex: Somos a Prottocode, desenvolvemos sites, sistemas e aplicativos. Nosso diferencial é o atendimento personalizado e prazos rápidos. Preço médio de R$2.000 a R$15.000.'
                : 'Ex: Sou desenvolvedor na Prottocode e quero apresentar nossos serviços de sites e sistemas. Quero parecer simpático, direto, e sugerir uma conversa rápida para entender as necessidades deles.'}
              rows={6}
              className="w-full px-4 py-3 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950
                placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400
                focus:bg-white transition-all duration-200 resize-none leading-relaxed"
            />
            {promptBase.trim().length > 0 && (
              <p className="mt-2 text-xs text-brand-300 flex items-center gap-1">
                <SparkleIcon className="w-3 h-3 text-violet-400" />
                {mode === 'funnel'
                  ? 'A IA vai usar esse contexto para conduzir as conversas pelo funil de vendas'
                  : 'A IA vai escrever uma mensagem nova antes de cada lote — nunca o texto acima'}
              </p>
            )}
          </Card>

          {/* Batch config */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-950">Configurações de Disparo</h3>
                <p className="text-xs text-brand-400">
                  {mode === 'funnel'
                    ? 'Intervalo aleatório entre cada envio de abordagem — anti-spam'
                    : 'Intervalo aleatório entre cada envio — anti-spam'}
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-4 ${mode === 'direct' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {mode === 'direct' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-brand-900">Mensagens por lote</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={50} value={batchSize}
                      onChange={(e) => setBatchSize(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950
                        focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                    />
                    <span className="text-xs text-brand-400">máx. 50</span>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-brand-900">Intervalo mínimo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={5} max={3600} value={intervalMin}
                    onChange={(e) => {
                      const v = Math.max(5, Math.min(3600, Number(e.target.value) || 5));
                      setIntervalMin(v);
                      if (v > intervalMax) setIntervalMax(v);
                    }}
                    className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950
                      focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                  />
                  <span className="text-xs text-brand-400">seg</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-brand-900">Intervalo máximo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={5} max={3600} value={intervalMax}
                    onChange={(e) => {
                      const v = Math.max(intervalMin, Math.min(3600, Number(e.target.value) || intervalMin));
                      setIntervalMax(v);
                    }}
                    className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950
                      focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                  />
                  <span className="text-xs text-brand-400">seg</span>
                </div>
              </div>
            </div>

            {mode === 'direct' && phones.length > 0 && (
              <div className="mt-4 px-4 py-3 bg-brand-50/60 border border-brand-100 rounded-xl">
                <p className="text-xs font-semibold text-brand-700 mb-1">Prévia do disparo</p>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-brand-500">
                  {Array.from({ length: totalBatches }).map((_, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-semibold">
                        Lote {i + 1}: {Math.min(batchSize, phones.length - i * batchSize)} msgs
                      </span>
                      {i < totalBatches - 1 && (
                        <span className="text-brand-300">&rarr; aguarda {formatInterval(intervalMin)}–{formatInterval(intervalMax)} &rarr;</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {mode === 'funnel' && phones.length > 0 && (
              <div className="mt-4 px-4 py-3 bg-violet-50/60 border border-violet-100 rounded-xl">
                <p className="text-xs font-semibold text-violet-700 mb-1">Prévia do funil</p>
                <p className="text-xs text-violet-500">
                  {phones.length} {phones.length === 1 ? 'conversa será iniciada' : 'conversas serão iniciadas'} com abordagem casual.
                  Respostas dos clientes serão conduzidas automaticamente pelo funil de vendas.
                </p>
              </div>
            )}
          </Card>

          <Button onClick={handleSend} disabled={phones.length === 0 || !promptBase.trim() || starting} size="lg">
            {starting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Iniciando...
              </>
            ) : mode === 'funnel' ? (
              <>
                <ChatIcon className="w-4 h-4" />
                Iniciar {phones.length} {phones.length === 1 ? 'conversa' : 'conversas'}
              </>
            ) : (
              <>
                <WaIcon className="w-4 h-4" />
                Disparar {phones.length} {phones.length === 1 ? 'mensagem' : 'mensagens'} em {totalBatches} {totalBatches === 1 ? 'lote' : 'lotes'}
              </>
            )}
          </Button>
        </>
      )}

      {/* ─── ACTIVE / DONE ─── */}
      {(phase === 'active' || phase === 'done') && (
        <>
          {/* Aviso de erro na geração */}
          {genError && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl animate-fade-in">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-xs font-bold text-red-600">Erro ao gerar mensagem com IA</p>
                <p className="text-xs text-red-400 mt-0.5">{genError}</p>
              </div>
              <button onClick={() => setGenError(null)} className="ml-auto text-red-300 hover:text-red-500 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Progress card */}
          <Card gradient>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                  {phase === 'done' ? (
                    mode === 'funnel' ? 'Conversas iniciadas' : 'Disparo concluído'
                  ) : validating ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-amber-700">Validando números no WhatsApp...</span>
                    </>
                  ) : batchGenerating && batchInfo ? (
                    <>
                      <SparkleIcon className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-violet-700">
                        Gerando mensagem — lote {batchInfo.current} de {batchInfo.total}...
                      </span>
                    </>
                  ) : batchInfo ? (
                    `Enviando lote ${batchInfo.current} de ${batchInfo.total}...`
                  ) : mode === 'funnel' ? (
                    'Enviando abordagens...'
                  ) : (
                    'Iniciando...'
                  )}
                </h3>
                <p className="text-xs text-brand-400 mt-0.5">
                  {validating ? (
                    'Verificando quais números possuem WhatsApp...'
                  ) : validationResult && !validating ? (
                    <>
                      {validationResult.valid} válidos
                      {validationResult.invalid > 0 && (
                        <span className="text-red-400 ml-1">· {validationResult.invalid} sem WhatsApp</span>
                      )}
                      {' · '}{sentCount} de {queue.length} {mode === 'funnel' ? 'abordagens enviadas' : 'mensagens enviadas'}
                      {queue.filter((j) => j.status === 'failed').length > 0 && (
                        <span className="text-red-400 ml-1">· {queue.filter((j) => j.status === 'failed').length} falharam</span>
                      )}
                    </>
                  ) : (
                    <>
                      {sentCount} de {queue.length} {mode === 'funnel' ? 'abordagens enviadas' : 'mensagens enviadas'}
                      {queue.filter((j) => j.status === 'failed').length > 0 && (
                        <span className="text-red-400 ml-1">· {queue.filter((j) => j.status === 'failed').length} falharam</span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-2xl font-bold gradient-text">{progress}%</span>
                {phase === 'active' && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100
                      text-red-500 hover:text-red-600 text-xs font-semibold rounded-lg border border-red-200
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Cancelando...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Parar disparo
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="w-full h-2 bg-brand-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  batchGenerating
                    ? 'bg-gradient-to-r from-violet-500 to-violet-300 animate-pulse'
                    : mode === 'funnel'
                      ? 'bg-gradient-to-r from-violet-500 to-violet-400'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                }`}
                style={{ width: batchGenerating ? '100%' : `${progress}%` }}
              />
            </div>

            <div className="flex items-center gap-4 mt-3">
              <StatusCount label="Aguardando" count={queue.filter((j) => j.status === 'pending').length} color="text-brand-400" />
              <StatusCount label="Enviando" count={queue.filter((j) => j.status === 'sending').length} color="text-amber-500" />
              <StatusCount label="Enviados" count={queue.filter((j) => j.status === 'sent').length} color="text-emerald-500" />
              <StatusCount label="Falhou" count={queue.filter((j) => j.status === 'failed').length} color="text-red-400" />
            </div>

            {/* Countdown entre lotes */}
            {phase === 'active' && countdown !== null && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-amber-50/80 border border-amber-200 rounded-xl animate-fade-in">
                <div className="relative w-12 h-12 shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#fde68a" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                      strokeDasharray={`${countdownPct} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-amber-600">
                    {countdown.remaining}s
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700">
                    {mode === 'funnel' ? 'Aguardando próximo envio' : 'Aguardando próximo lote'}
                  </p>
                  <p className="text-xs text-amber-500">
                    {mode === 'funnel'
                      ? `Próxima abordagem em ${formatInterval(countdown.remaining)} — anti-spam`
                      : `Nova mensagem gerada em ${formatInterval(countdown.remaining)} — anti-spam`}
                  </p>
                </div>
                {mode === 'direct' && batchInfo && batchInfo.current < batchInfo.total && (
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-amber-400 font-medium">PRÓXIMO</p>
                    <p className="text-xs font-bold text-amber-600">Lote {batchInfo.current + 1} de {batchInfo.total}</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Done summary — direct */}
          {phase === 'done' && mode === 'direct' && summary && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl px-5 py-4 animate-fade-in">
              <p className="text-sm font-semibold text-emerald-800">
                Disparo finalizado — <strong>{summary.sent}</strong>{' '}
                {summary.sent === 1 ? 'mensagem enviada' : 'mensagens enviadas'}
                {summary.failed > 0 && <span className="text-red-500">, {summary.failed} falharam</span>}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Link to="/leads/contatos" className="text-xs text-emerald-600 hover:underline font-semibold">
                  Ver contatos salvos &rarr;
                </Link>
                <button onClick={handleReset} className="text-xs text-emerald-500 hover:text-emerald-700 font-medium">
                  Novo disparo
                </button>
              </div>
            </div>
          )}

          {/* Done summary — funnel */}
          {phase === 'done' && mode === 'funnel' && funnelSummary && (
            <div className="bg-violet-50/80 border border-violet-200 rounded-2xl px-5 py-4 animate-fade-in">
              <p className="text-sm font-semibold text-violet-800">
                Abordagens enviadas — <strong>{funnelSummary.sent}</strong>{' '}
                {funnelSummary.sent === 1 ? 'conversa iniciada' : 'conversas iniciadas'}
                {funnelSummary.skipped > 0 && <span className="text-amber-500">, {funnelSummary.skipped} já existiam</span>}
                {funnelSummary.failed > 0 && <span className="text-red-500">, {funnelSummary.failed} falharam</span>}
              </p>
              <p className="text-xs text-violet-500 mt-1">
                As conversas serão conduzidas automaticamente pelo funil de vendas quando os clientes responderem.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Link to="/leads/whatsapp/conversas" className="text-xs text-violet-600 hover:underline font-semibold">
                  Acompanhar conversas &rarr;
                </Link>
                <button onClick={handleReset} className="text-xs text-violet-500 hover:text-violet-700 font-medium">
                  Novo envio
                </button>
              </div>
            </div>
          )}

          {/* Generated messages (direct only) */}
          {mode === 'direct' && batchMessages.length > 0 && (
            <Card>
              <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <SparkleIcon className="w-3.5 h-3.5 text-violet-400" />
                Mensagens geradas ({batchMessages.length})
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {batchMessages.map((m) => (
                  <div key={m.batch} className="px-4 py-3 bg-violet-50/50 border border-violet-100 rounded-xl">
                    <p className="text-[10px] font-semibold text-violet-500 mb-1">Lote {m.batch}</p>
                    <p className="text-sm text-brand-950 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Queue list */}
          <Card>
            <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3">
              {mode === 'funnel' ? 'Fila de abordagens' : 'Fila de envio'} ({queue.length})
            </h3>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {queue.map((job, idx) => {
                const s = STATUS_STYLE[job.status];
                const batchNum = mode === 'direct' ? Math.floor(idx / configSnapshot.batchSize) + 1 : null;
                return (
                  <div key={job.phone} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${s.bg}`}>
                    <span className={`shrink-0 ${s.text}`}>{s.icon}</span>
                    <WaIcon className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="flex-1 text-sm text-brand-950 font-medium truncate">{job.phone}</span>
                    {batchNum && <span className="text-[10px] text-brand-300 shrink-0">Lote {batchNum}</span>}
                    <span className={`text-[11px] font-semibold shrink-0 ${s.text}`}>{s.label}</span>
                    {job.error && (
                      <span className="text-[10px] text-red-400 truncate max-w-[140px]" title={job.error}>{job.error}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {showQueueManager && (
        <QueueManagerModal
          onClose={() => setShowQueueManager(false)}
          onChanged={() => {
            queuesAPI.getAll().then(({ data }) => setPhoneQueues(data)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function StatusCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-bold ${color}`}>{count}</span>
      <span className="text-xs text-brand-300">{label}</span>
    </div>
  );
}
