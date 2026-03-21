export type ContactStatus = 'new' | 'contacted' | 'negotiating' | 'client' | 'lost';
export type ContactChannel = 'email' | 'whatsapp' | 'manual';

export interface Contact {
  id: string;
  email: string;
  name: string;
  phone: string;
  company: string;
  status: ContactStatus;
  notes: string;
  channel?: ContactChannel;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailBlast {
  id: string;
  emails: string[];
  subject: string;
  body: string;
  sentAt: string;
  status: 'sent' | 'failed';
}
