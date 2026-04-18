export type ContactStatus = 'new' | 'contacted' | 'negotiating' | 'client' | 'lost';
export type ContactChannel = 'email' | 'whatsapp' | 'manual';
export type ContactMessageDirection = 'inbound' | 'outbound';

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
  lastReadAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  contactId: string;
  channel: ContactChannel;
  direction: ContactMessageDirection;
  content: string;
  sentAt: string;
  createdAt: string;
}

export interface EmailBlast {
  id: string;
  emails: string[];
  subject: string;
  body: string;
  sentAt: string;
  status: 'sent' | 'failed';
}
