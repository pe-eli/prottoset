export type ConversationStage = 'abordagem' | 'qualificacao' | 'gancho' | 'fechamento' | 'concluido';

export interface ConversationMessage {
  role: 'assistant' | 'client';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  phone: string;
  promptBase: string;
  stage: ConversationStage;
  messages: ConversationMessage[];
  autoReply: boolean;
  createdAt: string;
  updatedAt: string;
  rateLimited?: boolean; // Indica pausa por rate-limit
  replyDelaySeconds?: number; // Tempo restante para resposta automática
}
