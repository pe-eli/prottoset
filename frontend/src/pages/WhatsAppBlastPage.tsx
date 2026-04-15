
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { whatsappAPI } from '../features/whatsapp/whatsapp.api';
import { waInstanceAPI } from '../features/whatsapp/wa-instance.api';
import type { WaInstanceStatus } from '../features/whatsapp/wa-instance.api';
import { queuesAPI } from '../features/queues/queues.api';
import type { PhoneQueue } from '../features/queues/queues.types';
import { QueueManagerModal } from '../features/queues/QueueManagerModal';
import { useWaBlast } from '../contexts/WaBlastContext';

type JobStatus = 'pending' | 'sending' | 'sent' | 'failed';

interface QueueJob { phone: string; status: JobStatus; error?: string }
interface BlastSummary { sent: number; failed: number; total: number }
interface Countdown { remaining: number; total: number }
interface BatchInfo { current: number; total: number; count: number }
interface PromptTemplate { id: string; name: string; content: string }
const BUILT_IN_PROMPTS: PromptTemplate[] = [
  {
    id: 'preset-start-conversation',
    name: 'iniciar conversa',
    content: 'iniciar conversa',
  },
  {
    id: 'preset-followup-light',
    name: 'follow-up leve',
    content: 'reengajar contato com mensagem breve e cordial',
  },
];

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

function getAxiosErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(err)) {
    return err.response?.data?.error || fallback;
  }
  return fallback;
}

function isNotFoundAxiosError(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 404;
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



export function WhatsAppBlastPage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [phones, setPhones] = useState<string[]>([]);

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

  const [promptMode, setPromptMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(BUILT_IN_PROMPTS[0].id);
  const [customPrompts, setCustomPrompts] = useState<PromptTemplate[]>([]);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [customPromptName, setCustomPromptName] = useState('');
  const [customPromptContent, setCustomPromptContent] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);

  const [phoneQueues, setPhoneQueues] = useState<PhoneQueue[]>([]);
  const [showQueuePicker, setShowQueuePicker] = useState(false);
  const [showQueueManager, setShowQueueManager] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ total: number; eligible: number; skipped: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const safeQueue = useMemo(() => (Array.isArray(queue) ? queue : []), [queue]);

  // WhatsApp instance status
  const [waStatus, setWaStatus] = useState<WaInstanceStatus | null>(null);
  const [waStatusLoading, setWaStatusLoading] = useState(true);

  const esRef = useRef<EventSource | null>(null);
  const blastIdRef = useRef<string | null>(null);
  const reconnectedRef = useRef(false);

  const { active: globalActive, setActive: setGlobalActive, updateProgress, clearActive } = useWaBlast();

  useEffect(() => { return () => { esRef.current?.close(); }; }, []);

  useEffect(() => {
    queuesAPI.getAll().then(({ data }) => setPhoneQueues(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  // Fetch WhatsApp instance status
  useEffect(() => {
    waInstanceAPI.getStatus()
      .then(({ data }) => setWaStatus(data))
      .catch(() => setWaStatus({ status: 'not_created', phone: null, instanceName: null }))
      .finally(() => setWaStatusLoading(false));
  }, []);

  const totalBatches = Math.ceil(phones.length / batchSize);

  const selectedPreset = useMemo(
    () => BUILT_IN_PROMPTS.find((p) => p.id === selectedPresetId) ?? BUILT_IN_PROMPTS[0],
    [selectedPresetId],
  );

  const activePromptText = useMemo(() => {
    if (promptMode === 'preset') return selectedPreset.content;
    return customPromptContent.trim();
  }, [promptMode, selectedPreset, customPromptContent]);

  const activePromptName = useMemo(() => {
    if (promptMode === 'preset') return selectedPreset.name;
    return customPromptName.trim() || 'prompt personalizado';
  }, [promptMode, selectedPreset, customPromptName]);

  const resetCustomEditor = () => {
    setEditingPromptId(null);
    setCustomPromptName('');
    setCustomPromptContent('');
    setPromptError(null);
  };

  const handleLoadCustomPrompt = (id: string) => {
    const found = customPrompts.find((p) => p.id === id);
    if (!found) return;
    setEditingPromptId(found.id);
    setCustomPromptName(found.name);
    setCustomPromptContent(found.content);
    setPromptError(null);
  };

  const handleSavePrompt = () => {
    const name = customPromptName.trim();
    const content = customPromptContent.trim();
    if (!name) {
      setPromptError('Informe um nome para o prompt.');
      return;
    }
    if (!content) {
      setPromptError('Informe o conteúdo do prompt.');
      return;
    }

    const promptId = editingPromptId ?? `custom-${Date.now()}`;
    setCustomPrompts((prev) => {
      const exists = prev.some((p) => p.id === promptId);
      if (exists) {
        return prev.map((p) => (p.id === promptId ? { ...p, name, content } : p));
      }
      return [...prev, { id: promptId, name, content }];
    });
    setEditingPromptId(promptId);
    setPromptError(null);
  };

  const handleDeletePrompt = () => {
    if (!editingPromptId) return;
    setCustomPrompts((prev) => prev.filter((p) => p.id !== editingPromptId));
    resetCustomEditor();
  };

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
    const es = new EventSource(whatsappAPI.blastStreamUrl(blastId), { withCredentials: true });
    esRef.current = es;

    es.addEventListener('config', (e) => {
      const cfg = JSON.parse(e.data) as { batchSize: number };
      setConfigSnapshot({ batchSize: cfg.batchSize });
    });

    es.addEventListener('catchup', (e) => {
      const payload = JSON.parse(e.data) as unknown;
      const jobs: Array<{ phone: string; status: JobStatus; error?: string }> = Array.isArray(payload) ? payload : [];
      const restored = jobs.map((j) => ({ phone: j.phone, status: j.status, error: j.error }));
      setQueue(restored);
      // Sync context immediately so notification shows correct values
      const sent = restored.filter((j) => j.status === 'sent').length;
      if (restored.length > 0) updateProgress(sent, restored.length, 'sending');
    });

    es.addEventListener('validating', () => {
      setValidating(true);
      setValidationResult(null);
      setValidationError(null);
    });

    es.addEventListener('validation_done', (e) => {
      const info = JSON.parse(e.data) as { total: number; eligible: number; skipped: number };
      setValidating(false);
      setValidationResult(info);
    });

    es.addEventListener('validation_error', (e) => {
      const { error } = JSON.parse(e.data) as { error: string };
      setValidating(false);
      setValidationError(error);
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
      setQueue((prev) => (Array.isArray(prev) ? prev.map((j) => (j.phone === phone ? { ...j, status, error } : j)) : []));
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


  // Sync queue changes to global context (avoids calling updateProgress inside setQueue updater)
  useEffect(() => {
    if (phase !== 'active' || safeQueue.length === 0) return;
    const sent = safeQueue.filter((j) => j.status === 'sent').length;
    updateProgress(sent, safeQueue.length, 'sending');
  }, [safeQueue, phase, updateProgress]);

  useEffect(() => {
    if (reconnectedRef.current || !globalActive || globalActive.phase !== 'sending' || esRef.current) return;
    reconnectedRef.current = true;
    setPhase('active');
    connectToBlast(globalActive.blastId);
  }, [globalActive, connectToBlast]);

  const handleSend = async () => {
    if (phones.length === 0) return;
    if (!activePromptText) {
      alert('Defina um prompt antes de iniciar o disparo.');
      return;
    }
    setStarting(true);
    try {
      const { data } = await whatsappAPI.startBlast(phones, {
        batchSize,
        intervalMinSeconds: intervalMin,
        intervalMaxSeconds: intervalMax,
        promptBase: activePromptText,
      });
      const { blastId } = data;
      setQueue(phones.map((phone) => ({ phone, status: 'pending' })));
      setConfigSnapshot({ batchSize });
      setPhase('active');
      setPhones([]);
      setGlobalActive(blastId, data.total);
      connectToBlast(blastId);
    } catch (err: unknown) {
      alert(getAxiosErrorMessage(err, 'Erro ao iniciar disparo'));
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
    setCountdown(null);
    setBatchInfo(null);
    setBatchGenerating(false);
    setGenError(null);
    setBatchMessages([]);
    setCancelling(false);
    setValidating(false);
    setValidationResult(null);
    setValidationError(null);
  };

  const cancellingRef = useRef(false);

  const handleCancel = async () => {
    if (!blastIdRef.current || cancellingRef.current) return;
    cancellingRef.current = true;
    setCancelling(true);
    try {
      await whatsappAPI.cancelBlast(blastIdRef.current);
      // Finaliza imediatamente — não espera o SSE 'cancelled' (pode sofrer buffering)
      const sent = safeQueue.filter((j) => j.status === 'sent').length;
      const failed = safeQueue.filter((j) => j.status === 'failed').length;
      esRef.current?.close();
      esRef.current = null;
      setSummary({ sent, failed, total: safeQueue.length });
      setCountdown(null);
      setBatchGenerating(false);
      setPhase('done');
      clearActive();
      setCancelling(false);
    } catch (err: unknown) {
      // If 404 — blast no longer exists (backend restarted) — clear everything
      if (isNotFoundAxiosError(err)) {
        esRef.current?.close();
        esRef.current = null;
        setPhase('compose');
        clearActive();
        setQueue([]);
      }
      setCancelling(false);
    } finally {
      cancellingRef.current = false;
    }
  };

  const counts = useMemo(() => {
    const c = { pending: 0, sending: 0, sent: 0, failed: 0 };
    safeQueue.forEach((j) => { c[j.status]++; });
    return c;
  }, [safeQueue]);

  const sentCount = counts.sent;
  const doneCount = counts.sent + counts.failed;
  const progress = safeQueue.length > 0 ? Math.round((doneCount / safeQueue.length) * 100) : 0;
  const countdownPct = countdown ? (countdown.remaining / countdown.total) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/leads" className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Disparo de WhatsApp</h2>
          <p className="text-sm text-text-secondary">Mensagem inicial gerada automaticamente pela IA em cada lote — enviada via Evolution API</p>
        </div>
      </div>

      {/* ─── COMPOSE ─── */}
      {phase === 'compose' && (
        <>
          {/* WhatsApp connection status */}
          {!waStatusLoading && waStatus?.status !== 'connected' && (
            <div className="flex items-center gap-4 px-5 py-4 bg-amber-500/10 border border-amber-400/20 rounded-2xl animate-fade-in">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-200">WhatsApp nao conectado</p>
                <p className="text-xs text-amber-300/80 mt-0.5">Conecte seu WhatsApp para enviar mensagens</p>
              </div>
              <Link to="/leads/whatsapp/connect">
                <Button size="sm">
                  Conectar
                </Button>
              </Link>
            </div>
          )}

          {waStatus?.status === 'connected' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-400/20 rounded-2xl">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-semibold text-emerald-200">
                WhatsApp conectado{waStatus.phone ? ` (+${waStatus.phone})` : ''}
              </p>
              <Link to="/leads/whatsapp/connect" className="ml-auto text-xs text-emerald-300 hover:text-emerald-100 font-medium transition-colors">
                Gerenciar
              </Link>
            </div>
          )}


          {/* Destinatários */}
          <Card gradient>
            <h3 className="text-sm font-bold text-text-primary mb-1">Destinatários</h3>
            <p className="text-xs text-text-secondary mb-4">
              Cole ou digite números separados por vírgula, ponto-e-vírgula ou quebra de linha
            </p>

            {/* Queue import */}
            {phoneQueues.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setShowQueuePicker(!showQueuePicker)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary hover:bg-surface-elevated
                      text-text-primary text-xs font-semibold rounded-lg transition-colors"
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
                        className="inline-flex items-center gap-2 px-3 py-2 bg-surface hover:bg-surface-elevated
                          rounded-xl border border-border-light text-sm font-medium text-text-primary
                          transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span>{q.name}</span>
                        <span className="text-[10px] text-brand-200 bg-brand-500/12 px-1.5 py-0.5 rounded-md border border-brand-400/20">
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
                className="flex-1 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                  placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
                  focus:bg-surface-elevated transition-all duration-200 resize-none"
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
                    <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/12 text-emerald-200 rounded-lg text-xs font-medium border border-emerald-400/20">
                      <WaIcon className="w-3 h-3 text-emerald-500" />
                      {p}
                      <button onClick={() => removePhone(p)} className="w-4 h-4 rounded-full bg-emerald-400/15 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                        <svg className="w-2.5 h-2.5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Batch config */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-surface-secondary flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Configurações de Disparo</h3>
                <p className="text-xs text-text-secondary">Intervalo aleatório entre cada envio — anti-spam</p>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-violet-200 flex items-center gap-1.5">
                  <SparkleIcon className="w-3.5 h-3.5" />
                  Prompt da IA
                </p>
                <div className="inline-flex rounded-lg border border-violet-400/20 bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setPromptMode('preset')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      promptMode === 'preset' ? 'bg-violet-600 text-white' : 'text-violet-200 hover:bg-violet-500/10'
                    }`}
                  >
                    Pré-definido
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptMode('custom')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      promptMode === 'custom' ? 'bg-violet-600 text-white' : 'text-violet-200 hover:bg-violet-500/10'
                    }`}
                  >
                    Próprio
                  </button>
                </div>
              </div>

              {promptMode === 'preset' ? (
                <div className="mt-3 space-y-2">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-violet-400/20 rounded-xl text-sm text-text-primary
                      focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:border-violet-400 transition-all"
                  >
                    {BUILT_IN_PROMPTS.map((prompt) => (
                      <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
                    ))}
                  </select>
                  <div className="px-3 py-2 rounded-xl border border-violet-400/20 bg-surface-secondary/80">
                    <p className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">Conteúdo</p>
                    <p className="text-xs text-violet-100 mt-1">{selectedPreset.content}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {customPrompts.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={editingPromptId ?? ''}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) {
                            resetCustomEditor();
                            return;
                          }
                          handleLoadCustomPrompt(id);
                        }}
                        className="flex-1 px-3 py-2 bg-surface border border-violet-400/20 rounded-xl text-sm text-text-primary
                          focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:border-violet-400 transition-all"
                      >
                        <option value="">Selecionar prompt salvo</option>
                        {customPrompts.map((prompt) => (
                          <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={resetCustomEditor}
                        className="px-2.5 py-2 text-xs font-semibold rounded-lg border border-violet-400/20 text-violet-200 hover:bg-violet-500/10 transition-colors"
                      >
                        Novo
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    value={customPromptName}
                    onChange={(e) => {
                      setCustomPromptName(e.target.value);
                      if (promptError) setPromptError(null);
                    }}
                    placeholder="Nome do prompt"
                    className="w-full px-3 py-2 bg-surface border border-violet-400/20 rounded-xl text-sm text-text-primary
                      placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:border-violet-400 transition-all"
                  />
                  <textarea
                    rows={3}
                    value={customPromptContent}
                    onChange={(e) => {
                      setCustomPromptContent(e.target.value);
                      if (promptError) setPromptError(null);
                    }}
                    placeholder="Escreva o conteúdo do seu prompt"
                    className="w-full px-3 py-2 bg-surface border border-violet-400/20 rounded-xl text-sm text-text-primary resize-none
                      placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:border-violet-400 transition-all"
                  />
                  {promptError && <p className="text-xs text-red-500">{promptError}</p>}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSavePrompt}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                    >
                      {editingPromptId ? 'Salvar edição' : 'Salvar prompt'}
                    </button>
                    {editingPromptId && (
                      <button
                        type="button"
                        onClick={handleDeletePrompt}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              )}

              <p className="mt-2 text-xs text-violet-200">
                Prompt em uso: <strong>{activePromptName}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-primary">Mensagens por lote</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={50} value={batchSize}
                      onChange={(e) => setBatchSize(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                        focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                    />
                    <span className="text-xs text-brand-400">máx. 50</span>
                  </div>
                </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Intervalo mínimo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={5} max={3600} value={intervalMin}
                    onChange={(e) => {
                      const v = Math.max(5, Math.min(3600, Number(e.target.value) || 5));
                      setIntervalMin(v);
                      if (v > intervalMax) setIntervalMax(v);
                    }}
                    className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                      focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                  />
                  <span className="text-xs text-brand-400">seg</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Intervalo máximo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={5} max={3600} value={intervalMax}
                    onChange={(e) => {
                      const v = Math.max(intervalMin, Math.min(3600, Number(e.target.value) || intervalMin));
                      setIntervalMax(v);
                    }}
                    className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                      focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                  />
                  <span className="text-xs text-brand-400">seg</span>
                </div>
              </div>
            </div>

            {phones.length > 0 && (
              <div className="mt-4 px-4 py-3 bg-brand-500/10 border border-brand-400/20 rounded-xl">
                <p className="text-xs font-semibold text-brand-200 mb-1">Prévia do disparo</p>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-secondary">
                  {Array.from({ length: totalBatches }).map((_, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-200 rounded-md font-semibold">
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
          </Card>

          <Button onClick={handleSend} disabled={phones.length === 0 || starting || !activePromptText || waStatus?.status !== 'connected'} size="lg">
            {starting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Iniciando...
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
          {/* Validação em andamento */}
          {validating && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl animate-fade-in">
              <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-xs font-semibold text-blue-700">Validando números e verificando conversas existentes...</p>
            </div>
          )}

          {/* Resultado da validação */}
          {validationResult && validationResult.skipped > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl animate-fade-in">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-bold text-amber-700">Validação concluída</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {validationResult.eligible} de {validationResult.total} número{validationResult.total !== 1 ? 's' : ''} válido{validationResult.eligible !== 1 ? 's' : ''} para envio
                  &nbsp;·&nbsp;{validationResult.skipped} ignorado{validationResult.skipped !== 1 ? 's' : ''} (sem WhatsApp ou conversa já existente)
                </p>
              </div>
            </div>
          )}

          {/* Erro na validação */}
          {validationError && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl animate-fade-in">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-xs font-bold text-red-600">Erro na validação de números</p>
                <p className="text-xs text-red-400 mt-0.5">{validationError}</p>
              </div>
            </div>
          )}

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
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  {phase === 'done' ? (
                    'Disparo concluído'
                  ) : batchGenerating && batchInfo ? (
                    <>
                      <SparkleIcon className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-violet-200">
                        Gerando mensagem — lote {batchInfo.current} de {batchInfo.total}...
                      </span>
                    </>
                  ) : batchInfo ? (
                    `Enviando lote ${batchInfo.current} de ${batchInfo.total}...`
                  ) : (
                    'Iniciando...'
                  )}
                </h3>
                <p className="text-xs text-brand-400 mt-0.5">
                  {sentCount} de {safeQueue.length} mensagens enviadas
                  {counts.failed > 0 && (
                    <span className="text-red-400 ml-1">· {counts.failed} falharam</span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-2xl font-bold gradient-text">{progress}%</span>
                {phase === 'active' && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/15
                      text-red-200 hover:text-red-100 text-xs font-semibold rounded-lg border border-red-400/20
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

            <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  batchGenerating
                    ? 'bg-gradient-to-r from-violet-500 to-violet-300 animate-pulse'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                }`}
                style={{ width: batchGenerating ? '100%' : `${progress}%` }}
              />
            </div>

            <div className="flex items-center gap-4 mt-3">
              <StatusCount label="Aguardando" count={counts.pending} color="text-brand-400" />
              <StatusCount label="Enviando" count={counts.sending} color="text-amber-500" />
              <StatusCount label="Enviados" count={counts.sent} color="text-emerald-500" />
              <StatusCount label="Falhou" count={counts.failed} color="text-red-400" />
            </div>

            {/* Countdown entre lotes */}
            {phase === 'active' && countdown !== null && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-400/20 rounded-xl animate-fade-in">
                <div className="relative w-12 h-12 shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#5b4a1a" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                      strokeDasharray={`${countdownPct} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-amber-300">
                    {countdown.remaining}s
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-200">Aguardando próximo lote</p>
                  <p className="text-xs text-amber-300">
                    {`Nova mensagem gerada em ${formatInterval(countdown.remaining)} — anti-spam`}
                  </p>
                </div>
                {batchInfo && batchInfo.current < batchInfo.total && (
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-amber-300 font-medium">PRÓXIMO</p>
                    <p className="text-xs font-bold text-amber-200">Lote {batchInfo.current + 1} de {batchInfo.total}</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Done summary */}
          {phase === 'done' && summary && (
            <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-2xl px-5 py-4 animate-fade-in">
              <p className="text-sm font-semibold text-emerald-100">
                Disparo finalizado — <strong>{summary.sent}</strong>{' '}
                {summary.sent === 1 ? 'mensagem enviada' : 'mensagens enviadas'}
                {summary.failed > 0 && <span className="text-red-500">, {summary.failed} falharam</span>}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Link to="/leads/contatos" className="text-xs text-emerald-200 hover:underline font-semibold">
                  Ver contatos salvos &rarr;
                </Link>
                <button onClick={handleReset} className="text-xs text-emerald-300 hover:text-emerald-100 font-medium">
                  Novo disparo
                </button>
              </div>
            </div>
          )}



          {/* Generated messages */}
          {batchMessages.length > 0 && (
            <Card>
              <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <SparkleIcon className="w-3.5 h-3.5 text-violet-400" />
                Mensagens geradas ({batchMessages.length})
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {batchMessages.map((m) => (
                  <div key={m.batch} className="px-4 py-3 bg-violet-500/10 border border-violet-400/20 rounded-xl">
                    <p className="text-[10px] font-semibold text-violet-300 mb-1">Lote {m.batch}</p>
                    <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Queue list */}
          <Card>
            <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3">
              Fila de envio ({safeQueue.length})
            </h3>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {safeQueue.map((job, idx) => {
                const s = STATUS_STYLE[job.status];
                const batchNum = Math.floor(idx / configSnapshot.batchSize) + 1;
                return (
                  <div key={job.phone} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${s.bg}`}>
                    <span className={`shrink-0 ${s.text}`}>{s.icon}</span>
                    <WaIcon className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="flex-1 text-sm text-text-primary font-medium truncate">{job.phone}</span>
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
            queuesAPI.getAll().then(({ data }) => setPhoneQueues(Array.isArray(data) ? data : [])).catch(() => {});
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
