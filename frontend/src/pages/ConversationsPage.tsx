import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { AppNotification } from '../components/ui/Notification';
import { conversationsAPI } from '../features/conversations/conversations.api';
import type { Conversation, ConversationStage } from '../features/conversations/conversations.types';

const STAGE_CONFIG: Record<ConversationStage, { label: string; color: string; bg: string; border: string }> = {
  abordagem:    { label: 'Abordagem',    color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  qualificacao: { label: 'Qualificação', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  gancho:       { label: 'Gancho',       color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  fechamento:   { label: 'Fechamento',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  concluido:    { label: 'Concluído',    color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200' },
};

const STAGES: ConversationStage[] = ['abordagem', 'qualificacao', 'gancho', 'fechamento', 'concluido'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await conversationsAPI.getAll();
      setConversations(data);
      // Detecta rate-limit
      if (Array.isArray(data)) {
        const rateLimited = data.find((c: any) => c.rateLimited);
        if (rateLimited) {
          setNotification({
            message: `Aguardando liberação do limite de mensagens para o número ${rateLimited.phone}. O envio será retomado automaticamente.`,
            visible: true,
          });
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10_000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const handleToggleAutoReply = async (conv: Conversation) => {
    setUpdatingId(conv.id);
    try {
      const { data } = await conversationsAPI.update(conv.id, { autoReply: !conv.autoReply });
      setConversations((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    } catch { /* ignore */ }
    setUpdatingId(null);
  };

  const handleChangeStage = async (conv: Conversation, stage: ConversationStage) => {
    setUpdatingId(conv.id);
    try {
      const { data } = await conversationsAPI.update(conv.id, { stage });
      setConversations((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    } catch { /* ignore */ }
    setUpdatingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta conversa?')) return;
    try {
      await conversationsAPI.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { /* ignore */ }
  };

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s] = conversations.filter((c) => c.stage === s).length;
    return acc;
  }, {} as Record<ConversationStage, number>);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Notificação de rate-limit */}
      <AppNotification
        message={notification.message}
        visible={notification.visible}
        onClose={() => setNotification({ ...notification, visible: false })}
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/leads/whatsapp" className="w-9 h-9 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-950">Conversas do Funil</h2>
          <p className="text-sm text-brand-400">Acompanhe o progresso das conversas automáticas de vendas</p>
        </div>
      </div>

      {/* Webhook info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-bold text-blue-700">Webhook da Evolution API</p>
          <p className="text-xs text-blue-500 mt-0.5">
            Configure o webhook na Evolution API apontando para{' '}
            <code className="px-1.5 py-0.5 bg-blue-100 rounded text-blue-700 font-mono text-[11px]">
              http://SEU_IP:3001/api/conversations/webhook
            </code>{' '}
            para receber respostas dos clientes automaticamente.
          </p>
        </div>
      </div>

      {/* Stage stats */}
      <div className="grid grid-cols-5 gap-3">
        {STAGES.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          return (
            <div key={stage} className={`px-3 py-3 rounded-xl border ${cfg.border} ${cfg.bg} text-center`}>
              <p className={`text-2xl font-bold ${cfg.color}`}>{stageCounts[stage]}</p>
              <p className={`text-[11px] font-semibold ${cfg.color} opacity-70`}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Empty state */}
      {!loading && conversations.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-brand-950 mb-1">Nenhuma conversa ainda</p>
            <p className="text-xs text-brand-400 mb-4">Inicie conversas pelo modo "Iniciar conversa" na página de WhatsApp.</p>
            <Link
              to="/leads/whatsapp"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl hover:bg-brand-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Iniciar conversas
            </Link>
          </div>
        </Card>
      )}

      {/* Conversations list */}
      {!loading && conversations.length > 0 && (
        <div className="space-y-3">
          {conversations.map((conv) => {
            const cfg = STAGE_CONFIG[conv.stage];
            const isExpanded = expandedId === conv.id;
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isUpdating = updatingId === conv.id;

            return (
              <Card key={conv.id}>
                {/* Header row */}
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : conv.id)}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 ${cfg.bg} ${cfg.border} border rounded-xl flex items-center justify-center shrink-0 ${
                    conv.stage === 'concluido' && !conv.autoReply ? 'animate-pulse' : ''
                  }`}>
                    <svg className={`w-5 h-5 ${cfg.color}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-brand-950">{conv.phone}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {!conv.autoReply && conv.stage !== 'concluido' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-600">
                          Pausado
                        </span>
                      )}
                      {conv.stage === 'concluido' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Pronto para fechar
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-400 mt-0.5 truncate">
                      {lastMsg
                        ? `${lastMsg.role === 'assistant' ? 'Você' : 'Cliente'}: ${lastMsg.content}`
                        : 'Sem mensagens'}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-brand-300">{formatDate(conv.updatedAt)}</p>
                    <p className="text-[10px] text-brand-300 mt-0.5">{conv.messages.length} msgs</p>
                  </div>

                  {/* Chevron */}
                  <svg className={`w-4 h-4 text-brand-300 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded: chat + controls */}
                {isExpanded && (
                  <div className="mt-4 animate-fade-in">
                    {/* Tempo para resposta automática */}
                    {conv.replyDelaySeconds && conv.replyDelaySeconds > 0 && (
                      <div className="mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-xs text-brand-400 font-semibold">Respondendo em {conv.replyDelaySeconds}s...</span>
                      </div>
                    )}
                    {/* Chat history */}
                    {conv.messages.length > 0 && (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4 p-3 bg-surface-secondary rounded-xl border border-border-light">
                        {conv.messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                              msg.role === 'assistant'
                                ? 'bg-emerald-100 text-emerald-900 rounded-tr-sm'
                                : 'bg-white text-brand-900 border border-border-light rounded-tl-sm'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                              <p className={`text-[10px] mt-1 ${
                                msg.role === 'assistant' ? 'text-emerald-500' : 'text-brand-300'
                              }`}>
                                {formatDate(msg.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleAutoReply(conv); }}
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                          conv.autoReply
                            ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {conv.autoReply ? (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pausar auto-resposta
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Retomar auto-resposta
                          </>
                        )}
                      </button>

                      <select
                        value={conv.stage}
                        onChange={(e) => { e.stopPropagation(); handleChangeStage(conv, e.target.value as ConversationStage); }}
                        disabled={isUpdating}
                        className="px-3 py-1.5 bg-surface-secondary border border-border rounded-lg text-xs text-brand-950
                          focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:opacity-50"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                        ))}
                      </select>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                          bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors ml-auto"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
