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
  rateLimited?: boolean;
  replyDelaySeconds?: number;
  createdAt: string;
  updatedAt: string;
}
