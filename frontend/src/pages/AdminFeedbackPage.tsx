import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TextArea } from '../components/ui/TextArea';
import type { AuthUser } from '../features/auth/auth.api';
import { feedbackAPI } from '../features/feedback/feedback.api';
import { FEEDBACK_PRIORITY_OPTIONS, FEEDBACK_STATUS_OPTIONS, FEEDBACK_TYPE_OPTIONS, type FeedbackAttachmentDraft, type FeedbackPriority, type FeedbackStatus, type FeedbackThreadDetail, type FeedbackThreadSummary } from '../features/feedback/feedback.types';
import { canAccessFeedbackAdmin, fileToFeedbackAttachment, formatFeedbackDate, formatFeedbackPriority, formatFeedbackStatus, formatFeedbackType, priorityTone, resolveFeedbackAssetUrl, statusTone } from '../features/feedback/feedback.utils';
import { useToast } from '../contexts/useToast';

function InlineMeta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-border-light bg-surface-secondary px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text-primary break-all">{value}</p>
    </div>
  );
}

export function AdminFeedbackPage() {
  const { user } = useOutletContext<{ user: AuthUser }>();
  const { show: showToast } = useToast();
  const [threads, setThreads] = useState<FeedbackThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeedbackThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<FeedbackThreadSummary['type'] | 'ALL'>('ALL');
  const [replyAttachment, setReplyAttachment] = useState<FeedbackAttachmentDraft | undefined>();
  const [replyAttachmentName, setReplyAttachmentName] = useState<string | null>(null);

  const allowed = useMemo(() => canAccessFeedbackAdmin(user), [user]);

  const loadThreads = async () => {
    setLoading(true);
    try {
      const { data } = await feedbackAPI.listAdmin({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        search: search.trim() || undefined,
        limit: 100,
      });
      const nextThreads = Array.isArray(data.threads) ? data.threads : [];
      setThreads(nextThreads);
      if (!selectedId && nextThreads[0]) {
        setSelectedId(nextThreads[0].id);
      }
    } catch {
      showToast('Não foi possível carregar a inbox interna.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (threadId: string) => {
    setDetailLoading(true);
    try {
      const { data } = await feedbackAPI.getAdmin(threadId);
      setDetail(data.thread);
    } catch {
      showToast('Não foi possível abrir a thread.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadThreads();
  }, [allowed, statusFilter, priorityFilter, typeFilter]);

  useEffect(() => {
    if (!allowed || !selectedId) return;
    void loadDetail(selectedId);
  }, [allowed, selectedId]);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl animate-fade-in">
        <Card>
          <h1 className="text-2xl font-heading font-extrabold text-text-primary">Inbox interna restrita</h1>
          <p className="mt-2 text-sm text-text-secondary">Seu usuário não está autorizado a acessar o centro interno de feedback.</p>
        </Card>
      </div>
    );
  }

  const selectedThread = detail;
  const rootMetadata = (selectedThread?.messages[0]?.metadata ?? {}) as Record<string, string | undefined>;

  const syncThreadInList = (nextDetail: FeedbackThreadDetail) => {
    setThreads((previous) => [
      {
        ...nextDetail,
        lastMessagePreview: nextDetail.messages.at(-1)?.message ?? nextDetail.lastMessagePreview,
        lastSenderType: nextDetail.messages.at(-1)?.senderType ?? nextDetail.lastSenderType,
      },
      ...previous.filter((thread) => thread.id !== nextDetail.id),
    ]);
    setDetail(nextDetail);
  };

  const handleStatusChange = async (status: FeedbackStatus) => {
    if (!selectedThread) return;
    setSaving(true);
    try {
      const { data } = await feedbackAPI.updateStatus(selectedThread.id, status);
      syncThreadInList(data.thread);
      showToast('Status atualizado.', 'success');
    } catch {
      showToast('Não foi possível atualizar o status.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePriorityChange = async (priority: FeedbackPriority) => {
    if (!selectedThread) return;
    setSaving(true);
    try {
      const { data } = await feedbackAPI.updatePriority(selectedThread.id, priority);
      syncThreadInList(data.thread);
      showToast('Prioridade atualizada.', 'success');
    } catch {
      showToast('Não foi possível atualizar a prioridade.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async () => {
    if (!selectedThread || !replyMessage.trim()) return;
    setSaving(true);
    try {
      const { data } = await feedbackAPI.replyAdmin(selectedThread.id, {
        message: replyMessage.trim(),
        attachment: replyAttachment,
      });
      syncThreadInList(data.thread);
      setReplyMessage('');
      setReplyAttachment(undefined);
      setReplyAttachmentName(null);
      showToast('Resposta enviada com sucesso.', 'success');
    } catch {
      showToast('Não foi possível enviar a resposta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Feedback & Support Center</p>
          <h1 className="mt-1 text-3xl font-heading font-extrabold text-text-primary">Inbox interna do produto</h1>
          <p className="mt-2 text-sm text-text-secondary">Organize bugs, suporte, sugestões e feature requests com contexto completo.</p>
        </div>
        <Button variant="outline" onClick={() => void loadThreads()} disabled={loading}>Atualizar inbox</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="space-y-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por usuário ou assunto"
              className="w-full rounded-2xl border border-border bg-surface-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-400 focus:outline-none"
            />
            <div className="grid grid-cols-1 gap-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FeedbackStatus | 'ALL')} className="rounded-2xl border border-border bg-surface-secondary px-4 py-2.5 text-sm text-text-primary">
                <option value="ALL">Todos os status</option>
                {FEEDBACK_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatFeedbackStatus(status)}</option>)}
              </select>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as FeedbackPriority | 'ALL')} className="rounded-2xl border border-border bg-surface-secondary px-4 py-2.5 text-sm text-text-primary">
                <option value="ALL">Todas as prioridades</option>
                {FEEDBACK_PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{formatFeedbackPriority(priority)}</option>)}
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as FeedbackThreadSummary['type'] | 'ALL')} className="rounded-2xl border border-border bg-surface-secondary px-4 py-2.5 text-sm text-text-primary">
                <option value="ALL">Todos os tipos</option>
                {FEEDBACK_TYPE_OPTIONS.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => void loadThreads()} disabled={loading}>Aplicar filtros</Button>
          </div>

          <div className="mt-5 space-y-2">
            {loading && <div className="rounded-2xl border border-border-light bg-surface-secondary px-4 py-6 text-center text-sm text-text-muted">Carregando threads...</div>}
            {!loading && threads.map((thread) => (
              <button key={thread.id} type="button" onClick={() => setSelectedId(thread.id)} className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${thread.id === selectedId ? 'border-brand-400/45 bg-brand-400/12' : 'border-border-light bg-surface-secondary hover:bg-surface-elevated'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{thread.userName ?? 'Usuário'}</p>
                    <p className="text-xs text-text-muted">{formatFeedbackType(thread.type)} • {thread.planName ?? 'Sem plano'}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(thread.status)}`}>{formatFeedbackStatus(thread.status)}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{thread.subject}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                  <span>{formatFeedbackDate(thread.lastMessageAt)}</span>
                  <span className={`rounded-full border px-2 py-1 ${priorityTone(thread.priority)}`}>{formatFeedbackPriority(thread.priority)}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-h-[72vh] p-0 overflow-hidden">
          {!selectedThread && (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-text-muted">Selecione um feedback para abrir a thread.</div>
          )}

          {selectedThread && (
            <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="border-b border-border-light p-5 lg:border-b-0 lg:border-r lg:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Thread</p>
                    <h2 className="mt-1 text-2xl font-heading font-extrabold text-text-primary">{selectedThread.subject}</h2>
                    <p className="mt-2 text-sm text-text-secondary">{selectedThread.userName} • {selectedThread.userEmail}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(selectedThread.status)}`}>{formatFeedbackStatus(selectedThread.status)}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityTone(selectedThread.priority)}`}>{formatFeedbackPriority(selectedThread.priority)}</span>
                    {selectedThread.similarCount && selectedThread.similarCount > 1 && (
                      <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-semibold text-brand-200">{selectedThread.similarCount} usuários pediram algo parecido</span>
                    )}
                  </div>
                </div>

                {detailLoading ? (
                  <div className="mt-6 rounded-2xl border border-border-light bg-surface-secondary px-4 py-8 text-center text-sm text-text-muted">Carregando conversa...</div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {selectedThread.messages.map((message) => (
                      <div key={message.id} className={`rounded-2xl border px-4 py-3 ${message.senderType === 'ADMIN' ? 'border-brand-400/30 bg-brand-400/8' : 'border-border-light bg-surface-secondary'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{message.senderType === 'ADMIN' ? 'Time Closr' : selectedThread.userName}</p>
                            <p className="text-xs text-text-muted">{formatFeedbackDate(message.createdAt)}</p>
                          </div>
                          <span className="text-[11px] uppercase tracking-[0.18em] text-text-muted">{message.senderType}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{message.message}</p>
                        {message.attachments.length > 0 && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {message.attachments.map((attachment) => (
                              <a key={attachment.id} href={resolveFeedbackAssetUrl(attachment.fileUrl)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-border-light bg-background">
                                <img src={resolveFeedbackAssetUrl(attachment.fileUrl)} alt="Screenshot anexado" className="h-40 w-full object-cover" loading="lazy" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 rounded-[28px] border border-border-light bg-surface p-5">
                  <TextArea label="Responder no app" placeholder="Escreva uma resposta objetiva e útil..." className="min-h-28" value={replyMessage} onChange={(event) => setReplyMessage(event.target.value)} />
                  <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-border-light bg-surface-secondary px-4 py-3 text-sm text-text-secondary hover:border-brand-400/30 hover:text-text-primary">
                    <span>{replyAttachmentName ?? 'Anexar screenshot'}</span>
                    <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const attachment = await fileToFeedbackAttachment(file);
                      setReplyAttachment(attachment);
                      setReplyAttachmentName(file.name);
                    }} />
                    <span className="text-xs text-brand-300">Opcional</span>
                  </label>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => void handleReply()} disabled={saving || !replyMessage.trim()}>{saving ? 'Enviando...' : 'Responder thread'}</Button>
                  </div>
                </div>
              </div>

              <aside className="p-5 lg:p-6 bg-surface-secondary/45">
                <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Contexto técnico</p>
                <div className="mt-4 grid gap-2">
                  <InlineMeta label="Tenant" value={selectedThread.tenantId} />
                  <InlineMeta label="Plano" value={selectedThread.planName} />
                  <InlineMeta label="Status assinatura" value={selectedThread.subscriptionStatus ?? undefined} />
                  <InlineMeta label="Rota" value={rootMetadata.route} />
                  <InlineMeta label="URL" value={rootMetadata.url} />
                  <InlineMeta label="Browser" value={rootMetadata.browser} />
                  <InlineMeta label="Device" value={rootMetadata.device} />
                  <InlineMeta label="Viewport" value={typeof rootMetadata.viewport === 'string' ? rootMetadata.viewport : undefined} />
                  <InlineMeta label="Versão do app" value={rootMetadata.appVersion} />
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-text-muted">Status</label>
                    <select value={selectedThread.status} onChange={(event) => void handleStatusChange(event.target.value as FeedbackStatus)} className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary" disabled={saving}>
                      {FEEDBACK_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatFeedbackStatus(status)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-text-muted">Prioridade</label>
                    <select value={selectedThread.priority} onChange={(event) => void handlePriorityChange(event.target.value as FeedbackPriority)} className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary" disabled={saving}>
                      {FEEDBACK_PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{formatFeedbackPriority(priority)}</option>)}
                    </select>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
