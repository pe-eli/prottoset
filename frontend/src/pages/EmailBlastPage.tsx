import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { TextArea } from '../components/ui/TextArea';
import { SubscriptionLockedView } from '../components/subscription/SubscriptionLockedView';
import { useSubscription } from '../contexts/SubscriptionContext';
import { contactsAPI } from '../features/contacts/contacts.api';

const DEFAULT_SUBJECT = 'Transforme sua presença digital — Closr';
const DEFAULT_BODY = `Olá!

Meu nome é [Seu Nome] e sou desenvolvedor na Closr.

Notei que seu negócio tem um grande potencial para crescer no digital. Trabalhamos com criação de sites, sistemas web e landing pages de alta conversão, tudo personalizado para as necessidades do seu negócio.

Gostaria de agendar uma conversa rápida (15 min) para entender seus objetivos e mostrar como posso ajudar.

Posso te ligar ou trocar uma ideia pelo WhatsApp?

Abraço,
[Seu Nome]
Closr — Plataforma de Prospecção Inteligente`;

type JobStatus = 'pending' | 'sending' | 'sent' | 'failed';

interface QueueJob {
  email: string;
  status: JobStatus;
  error?: string;
}

interface BlastSummary {
  sent: number;
  failed: number;
  total: number;
}

interface Countdown {
  remaining: number;
  total: number;
}

interface BatchInfo {
  current: number;
  total: number;
  count: number;
}

const STATUS_STYLE: Record<JobStatus, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  pending: {
    bg: 'bg-brand-50 border-brand-100',
    text: 'text-brand-400',
    label: 'Aguardando',
    icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  sending: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-600',
    label: 'Enviando',
    icon: <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>,
  },
  sent: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-600',
    label: 'Enviado',
    icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>,
  },
  failed: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-500',
    label: 'Falhou',
    icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  },
};

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}

export function EmailBlastPage() {
  const { subscription } = useSubscription();
  const hasActiveSubscription = subscription?.status === 'active';

  const savedResendApiKey = typeof window !== 'undefined' ? localStorage.getItem('closr.emailBlast.resendApiKey') || '' : '';
  const savedResendFrom = typeof window !== 'undefined' ? localStorage.getItem('closr.emailBlast.resendFrom') || '' : '';

  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [resendApiKey, setResendApiKey] = useState(savedResendApiKey);
  const [resendFrom, setResendFrom] = useState(savedResendFrom);

  // Batch config
  const [batchSize, setBatchSize] = useState(10);
  const [intervalMin, setIntervalMin] = useState(15);
  const [intervalMax, setIntervalMax] = useState(45);

  // Queue state
  const [phase, setPhase] = useState<'compose' | 'running' | 'done'>('compose');
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [summary, setSummary] = useState<BlastSummary | null>(null);
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const safeQueue = Array.isArray(queue) ? queue : [];

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('closr.emailBlast.resendApiKey', resendApiKey);
  }, [resendApiKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('closr.emailBlast.resendFrom', resendFrom);
  }, [resendFrom]);

  const totalBatches = Math.ceil(emails.length / batchSize);

  const addEmails = () => {
    const parsed = emailInput
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes('@'));
    setEmails((prev) => [...new Set([...prev, ...parsed])]);
    setEmailInput('');
  };

  const removeEmail = (email: string) => setEmails((prev) => prev.filter((e) => e !== email));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addEmails(); }
  };

  const handleSend = async () => {
    if (emails.length === 0) return;
    const normalizedApiKey = resendApiKey.trim();
    const normalizedFrom = resendFrom.trim();

    if (!normalizedApiKey) {
      alert('Informe sua RESEND_API_KEY para iniciar o disparo.');
      return;
    }
    if (!normalizedFrom) {
      alert('Informe seu RESEND_FROM para iniciar o disparo.');
      return;
    }

    setStarting(true);
    try {
      const { data } = await contactsAPI.startBlast(emails, subject, body, {
        batchSize,
        intervalMinSeconds: intervalMin,
        intervalMaxSeconds: intervalMax,
        resendApiKey: normalizedApiKey,
        resendFrom: normalizedFrom,
      });
      const { blastId } = data;

      setQueue(emails.map((email) => ({ email, status: 'pending' })));
      setPhase('running');
      setEmails([]);

      const url = contactsAPI.blastStreamUrl(blastId);
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.addEventListener('catchup', (e) => {
        const payload = JSON.parse(e.data) as unknown;
        const jobs: Array<{ email: string; status: JobStatus; error?: string }> = Array.isArray(payload) ? payload : [];
        setQueue(jobs.map((j) => ({ email: j.email, status: j.status, error: j.error })));
      });

      es.addEventListener('batch_start', (e) => {
        const info = JSON.parse(e.data) as { batch: number; totalBatches: number; count: number };
        setBatchInfo({ current: info.batch, total: info.totalBatches, count: info.count });
        setCountdown(null);
      });

      es.addEventListener('progress', (e) => {
        const { email, status, error } = JSON.parse(e.data) as { email: string; status: JobStatus; error?: string };
        setQueue((prev) => (Array.isArray(prev) ? prev.map((j) => (j.email === email ? { ...j, status, error } : j)) : []));
      });

      es.addEventListener('tick', (e) => {
        const { remaining, total } = JSON.parse(e.data) as { remaining: number; total: number };
        setCountdown({ remaining, total });
      });

      es.addEventListener('done', (e) => {
        const d: BlastSummary = JSON.parse(e.data);
        setSummary(d);
        setCountdown(null);
        setPhase('done');
        es.close();
        esRef.current = null;
      });

      es.onerror = () => {
        setQueue((prev) =>
          (Array.isArray(prev) ? prev : []).map((j) =>
            j.status === 'pending' || j.status === 'sending'
              ? { ...j, status: 'failed', error: 'Conexão perdida' }
              : j
          )
        );
        setPhase('done');
        es.close();
        esRef.current = null;
      };
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao iniciar disparo');
    } finally {
      setStarting(false);
    }
  };

  const handleReset = () => {
    esRef.current?.close();
    setPhase('compose');
    setQueue([]);
    setSummary(null);
    setCountdown(null);
    setBatchInfo(null);
  };

  const sentCount = safeQueue.filter((j) => j.status === 'sent').length;
  const doneCount = safeQueue.filter((j) => j.status === 'sent' || j.status === 'failed').length;
  const progress = safeQueue.length > 0 ? Math.round((doneCount / safeQueue.length) * 100) : 0;
  const countdownPct = countdown ? (countdown.remaining / countdown.total) * 100 : 0;

  if (!hasActiveSubscription) {
    return (
      <SubscriptionLockedView
        featureName="Disparo de E-mails"
        description="Este recurso faz parte dos planos pagos. Assine para enviar campanhas por e-mail e acompanhar os resultados."
      />
    );
  }

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
          <h2 className="text-2xl font-bold text-text-primary">Disparo de E-mails</h2>
          <p className="text-sm text-text-secondary">Envie em lotes com intervalo anti-spam configurável</p>
        </div>
      </div>

      {/* ─── COMPOSE PHASE ─── */}
      {phase === 'compose' && (
        <>
          {/* Destinatários */}
          <Card gradient>
            <h3 className="text-sm font-bold text-text-primary mb-1">Destinatários</h3>
            <p className="text-xs text-text-secondary mb-4">Cole ou digite e-mails separados por vírgula, ponto-e-vírgula ou quebra de linha</p>
            <div className="flex gap-2">
              <textarea
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="email1@exemplo.com, email2@exemplo.com..."
                rows={3}
                className="flex-1 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                  placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
                  focus:bg-surface-elevated transition-all duration-200 resize-none"
              />
              <Button onClick={addEmails} variant="secondary" className="self-end">Adicionar</Button>
            </div>

            {emails.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-brand-400">
                    {emails.length} {emails.length === 1 ? 'destinatário' : 'destinatários'}
                  </p>
                  <button onClick={() => setEmails([])} className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium">
                    Limpar todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-3 bg-surface-secondary rounded-xl border border-border-light">
                  {emails.map((email) => (
                    <span key={email} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-500/12 text-brand-200 rounded-lg text-xs font-medium border border-brand-400/20">
                      {email}
                      <button onClick={() => removeEmail(email)} className="w-4 h-4 rounded-full bg-brand-400/15 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                        <svg className="w-2.5 h-2.5 text-brand-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Configurações de batch */}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Batch size */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Emails por lote</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                      focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all
                      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-brand-400">máx. 50</span>
                </div>
              </div>

              {/* Interval min */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Intervalo mínimo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={intervalMin}
                    onChange={(e) => {
                      const v = Math.max(5, Math.min(3600, Number(e.target.value) || 5));
                      setIntervalMin(v);
                      if (v > intervalMax) setIntervalMax(v);
                    }}
                    className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                      focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all
                      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-brand-400">seg</span>
                </div>
              </div>

              {/* Interval max */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Intervalo máximo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={intervalMax}
                    onChange={(e) => {
                      const v = Math.max(intervalMin, Math.min(3600, Number(e.target.value) || intervalMin));
                      setIntervalMax(v);
                    }}
                    className="w-24 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary
                      focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all
                      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-brand-400">seg</span>
                </div>
              </div>
            </div>

            {/* Preview do batch */}
            {emails.length > 0 && (
              <div className="mt-4 px-4 py-3 bg-brand-500/10 border border-brand-400/20 rounded-xl">
                <p className="text-xs font-semibold text-brand-200 mb-1">Prévia do disparo</p>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-secondary">
                  {Array.from({ length: totalBatches }).map((_, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-brand-400/15 text-brand-100 rounded-md font-semibold">
                        Lote {i + 1}: {Math.min(batchSize, emails.length - i * batchSize)} emails
                      </span>
                      {i < totalBatches - 1 && (
                        <span className="text-brand-300">→ aguarda {formatInterval(intervalMin)}–{formatInterval(intervalMax)} →</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-surface-secondary flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Credenciais do seu envio</h3>
                <p className="text-xs text-text-secondary">Cada usuário envia com a própria conta do Resend</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Input
                label="RESEND_API_KEY"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_********************************"
                autoComplete="off"
              />
              <Input
                label="RESEND_FROM"
                value={resendFrom}
                onChange={(e) => setResendFrom(e.target.value)}
                placeholder="Seu Nome <noreply@seudominio.com>"
                autoComplete="off"
              />
            </div>
          </Card>

          {/* Template */}
          <Card>
            <h3 className="text-sm font-bold text-text-primary mb-1">Template do E-mail</h3>
            <p className="text-xs text-text-secondary mb-4">Customize o assunto e corpo do e-mail</p>
            <div className="space-y-4">
              <Input
                label="Assunto"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do e-mail..."
              />
              <TextArea
                label="Corpo do E-mail"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="!min-h-[220px] font-mono text-xs leading-relaxed"
              />
            </div>
          </Card>

          <Button
            onClick={handleSend}
            disabled={emails.length === 0 || !subject.trim() || !body.trim() || !resendApiKey.trim() || !resendFrom.trim() || starting}
            size="lg"
          >
            {starting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Iniciando fila...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Disparar {emails.length} emails em {totalBatches} {totalBatches === 1 ? 'lote' : 'lotes'}
              </>
            )}
          </Button>
        </>
      )}

      {/* ─── RUNNING / DONE PHASE ─── */}
      {(phase === 'running' || phase === 'done') && (
        <>
          {/* Progress card */}
          <Card gradient>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  {phase === 'done' ? 'Disparo concluído' : batchInfo
                    ? `Enviando lote ${batchInfo.current} de ${batchInfo.total}...`
                    : 'Iniciando disparo...'}
                </h3>
                <p className="text-xs text-brand-400 mt-0.5">
                  {sentCount} de {safeQueue.length} emails enviados
                  {safeQueue.filter((j) => j.status === 'failed').length > 0 && (
                    <span className="text-red-400 ml-1">
                      · {safeQueue.filter((j) => j.status === 'failed').length} falhou
                    </span>
                  )}
                </p>
              </div>
              <span className="text-2xl font-bold gradient-text">{progress}%</span>
            </div>

            <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Status counts */}
            <div className="flex items-center gap-4 mt-3">
              <StatusCount label="Aguardando" count={safeQueue.filter((j) => j.status === 'pending').length} color="text-brand-400" />
              <StatusCount label="Enviando" count={safeQueue.filter((j) => j.status === 'sending').length} color="text-amber-500" />
              <StatusCount label="Enviados" count={safeQueue.filter((j) => j.status === 'sent').length} color="text-emerald-500" />
              <StatusCount label="Falhou" count={safeQueue.filter((j) => j.status === 'failed').length} color="text-red-400" />
            </div>

            {/* Countdown entre lotes */}
            {phase === 'running' && countdown !== null && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-400/20 rounded-xl animate-fade-in">
                <div className="relative w-12 h-12 shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#5b4a1a" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke="#f59e0b" strokeWidth="3"
                      strokeDasharray={`${countdownPct} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-amber-300">
                    {countdown.remaining}s
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-200">
                    Intervalo entre lotes
                  </p>
                  <p className="text-xs text-amber-300">
                    Próximo lote em {formatInterval(countdown.remaining)} — anti-spam
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
                Disparo finalizado — <strong>{summary.sent}</strong> enviados
                {summary.failed > 0 && <span className="text-red-500">, {summary.failed} falharam</span>}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Link to="/leads/contatos" className="text-xs text-emerald-200 hover:underline font-semibold">
                  Ver contatos salvos →
                </Link>
                <button onClick={handleReset} className="text-xs text-emerald-300 hover:text-emerald-100 font-medium">
                  Novo disparo
                </button>
              </div>
            </div>
          )}

          {/* Queue list */}
          <Card>
            <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3">
              Fila de envio ({safeQueue.length})
            </h3>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {safeQueue.map((job, idx) => {
                const s = STATUS_STYLE[job.status];
                const batchNum = Math.floor(idx / batchSize) + 1;
                return (
                  <div
                    key={job.email}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${s.bg}`}
                  >
                    <span className={`shrink-0 ${s.text}`}>{s.icon}</span>
                    <span className="flex-1 text-sm text-text-primary font-medium truncate">{job.email}</span>
                    <span className="text-[10px] text-brand-300 shrink-0">Lote {batchNum}</span>
                    <span className={`text-[11px] font-semibold shrink-0 ${s.text}`}>{s.label}</span>
                    {job.error && (
                      <span className="text-[10px] text-red-400 truncate max-w-[140px]" title={job.error}>
                        {job.error}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
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
