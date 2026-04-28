import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/TextArea';
import { useFeedback } from '../../contexts/useFeedback';
import { FEEDBACK_TYPE_OPTIONS, type FeedbackAttachment, type FeedbackThreadDetail, type FeedbackThreadSummary, type FeedbackType } from './feedback.types';
import { fileToFeedbackAttachment, formatFeedbackDate, formatFeedbackPriority, formatFeedbackStatus, formatFeedbackType, priorityTone, resolveFeedbackAssetUrl, statusTone } from './feedback.utils';

function MetadataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text-primary break-all">{value}</p>
    </div>
  );
}

function AttachmentGrid({ attachments }: { attachments: FeedbackAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={resolveFeedbackAssetUrl(attachment.fileUrl)}
          target="_blank"
          rel="noreferrer"
          className="overflow-hidden rounded-2xl border border-border-light bg-surface-secondary"
        >
          <img
            src={resolveFeedbackAssetUrl(attachment.fileUrl)}
            alt="Screenshot enviado no feedback"
            className="h-40 w-full object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}

function ThreadCard({ thread, selected, onSelect }: { thread: FeedbackThreadSummary; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${selected ? 'border-brand-400/45 bg-brand-400/10' : 'border-border-light bg-surface-secondary hover:border-border-light hover:bg-surface-elevated'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{thread.subject}</p>
          <p className="mt-1 text-xs text-text-muted">{formatFeedbackType(thread.type)} • {formatFeedbackDate(thread.lastMessageAt)}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(thread.status)}`}>
          {formatFeedbackStatus(thread.status)}
        </span>
      </div>
      {thread.lastMessagePreview && (
        <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{thread.lastMessagePreview}</p>
      )}
    </button>
  );
}

function ThreadMessage({ detail, thread }: { detail: FeedbackThreadDetail; thread: FeedbackThreadDetail['messages'][number] }) {
  const metadata = thread.metadata as Record<string, string | undefined>;
  const isAdmin = thread.senderType === 'ADMIN';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${isAdmin ? 'border-brand-400/30 bg-brand-400/8' : 'border-border-light bg-surface-secondary'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{isAdmin ? 'Time Closr' : 'Você'}</p>
          <p className="text-xs text-text-muted">{formatFeedbackDate(thread.createdAt)}</p>
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-text-muted">{thread.senderType}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{thread.message}</p>
      <AttachmentGrid attachments={thread.attachments} />
      {!isAdmin && thread.id === detail.messages[0]?.id && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <MetadataRow label="Rota" value={metadata.route} />
          <MetadataRow label="URL" value={metadata.url} />
          <MetadataRow label="Browser" value={metadata.browser} />
          <MetadataRow label="Plano" value={metadata.plan} />
        </div>
      )}
    </div>
  );
}

export function FeedbackCenterModal() {
  const {
    isOpen,
    close,
    threads,
    activeThread,
    activeThreadId,
    loading,
    detailLoading,
    submitting,
    selectThread,
    createThread,
    replyToThread,
  } = useFeedback();
  const [type, setType] = useState<FeedbackType>('BUG');
  const [message, setMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [replyAttachmentName, setReplyAttachmentName] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Awaited<ReturnType<typeof fileToFeedbackAttachment>> | undefined>();
  const [replyAttachment, setReplyAttachment] = useState<Awaited<ReturnType<typeof fileToFeedbackAttachment>> | undefined>();

  const emptyState = useMemo(() => !activeThread && threads.length === 0, [activeThread, threads.length]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!message.trim()) return;
    await createThread({ type, message: message.trim(), attachment });
    setMessage('');
    setAttachment(undefined);
    setAttachmentName(null);
  };

  const handleReply = async () => {
    if (!activeThreadId || !replyMessage.trim()) return;
    await replyToThread({ threadId: activeThreadId, message: replyMessage.trim(), attachment: replyAttachment });
    setReplyMessage('');
    setReplyAttachment(undefined);
    setReplyAttachmentName(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={close}>
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-border-light bg-background shadow-2xl shadow-black/40" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Feedback & Support Center</p>
            <h2 className="mt-1 text-xl font-heading font-extrabold text-text-primary">Canal rápido entre usuário e produto</h2>
          </div>
          <button type="button" onClick={close} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-light bg-surface-secondary text-text-secondary hover:text-text-primary">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-b border-border-light p-4 lg:border-b-0 lg:border-r lg:p-5">
            <div className="rounded-3xl border border-border-light bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-300">Novo envio</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {FEEDBACK_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all ${type === option.value ? 'border-brand-400/45 bg-brand-400/12 text-text-primary' : 'border-border-light bg-surface-secondary text-text-secondary hover:text-text-primary'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <TextArea
                label="Mensagem"
                placeholder="Descreva sua mensagem..."
                className="mt-4 min-h-32"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-border-light bg-surface-secondary px-4 py-3 text-sm text-text-secondary hover:border-brand-400/30 hover:text-text-primary">
                <span>{attachmentName ?? 'Adicionar screenshot opcional'}</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const nextAttachment = await fileToFeedbackAttachment(file);
                    setAttachment(nextAttachment);
                    setAttachmentName(file.name);
                  }}
                />
                <span className="text-xs text-brand-300">PNG, JPG, WEBP</span>
              </label>
              <Button className="mt-4 w-full" onClick={() => void handleCreate()} disabled={submitting || !message.trim()}>
                {submitting ? 'Enviando...' : 'Enviar feedback'}
              </Button>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Inbox</p>
                  <h3 className="text-base font-bold text-text-primary">Minhas conversas</h3>
                </div>
                {loading && <span className="text-xs text-text-muted">Atualizando...</span>}
              </div>
              <div className="space-y-2">
                {threads.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    selected={thread.id === activeThreadId}
                    onSelect={() => void selectThread(thread.id)}
                  />
                ))}
                {threads.length === 0 && (
                  <div className="rounded-2xl border border-border-light bg-surface-secondary px-4 py-6 text-center text-sm text-text-muted">
                    {emptyState ? 'Envie o primeiro feedback em segundos.' : 'Nenhuma conversa encontrada.'}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {!activeThread && (
              <div className="flex h-full min-h-64 items-center justify-center rounded-[28px] border border-border-light bg-surface-secondary/60 px-6 text-center">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-brand-300">Acompanhe o histórico</p>
                  <h3 className="mt-2 text-2xl font-heading font-extrabold text-text-primary">Tudo em um inbox leve</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
                    Abra uma conversa para acompanhar respostas, screenshots e contexto do problema sem depender de chat em tempo real.
                  </p>
                </div>
              </div>
            )}

            {activeThread && (
              <div className="space-y-5">
                <div className="rounded-[28px] border border-border-light bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-brand-300">Thread selecionada</p>
                      <h3 className="mt-1 text-2xl font-heading font-extrabold text-text-primary">{activeThread.subject}</h3>
                      <p className="mt-2 text-sm text-text-secondary">{formatFeedbackType(activeThread.type)} • última atividade {formatFeedbackDate(activeThread.lastMessageAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(activeThread.status)}`}>{formatFeedbackStatus(activeThread.status)}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityTone(activeThread.priority)}`}>{formatFeedbackPriority(activeThread.priority)}</span>
                      {activeThread.similarCount && activeThread.similarCount > 1 && (
                        <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-semibold text-brand-200">
                          {activeThread.similarCount} pedidos parecidos
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {detailLoading ? (
                  <div className="rounded-3xl border border-border-light bg-surface-secondary px-5 py-8 text-center text-sm text-text-muted">Carregando conversa...</div>
                ) : (
                  <div className="space-y-3">
                    {activeThread.messages.map((thread) => (
                      <ThreadMessage key={thread.id} detail={activeThread} thread={thread} />
                    ))}
                  </div>
                )}

                <div className="rounded-[28px] border border-border-light bg-surface p-5">
                  <TextArea
                    label="Responder"
                    placeholder="Continue a conversa sem fricção..."
                    className="min-h-28"
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                  />
                  <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-border-light bg-surface-secondary px-4 py-3 text-sm text-text-secondary hover:border-brand-400/30 hover:text-text-primary">
                    <span>{replyAttachmentName ?? 'Anexar novo screenshot'}</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const nextAttachment = await fileToFeedbackAttachment(file);
                        setReplyAttachment(nextAttachment);
                        setReplyAttachmentName(file.name);
                      }}
                    />
                    <span className="text-xs text-brand-300">Opcional</span>
                  </label>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => void handleReply()} disabled={submitting || !replyMessage.trim()}>
                      {submitting ? 'Enviando...' : 'Enviar resposta'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
