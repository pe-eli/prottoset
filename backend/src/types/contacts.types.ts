export type ContactStatus = 'new' | 'contacted' | 'no_reply' | 'interested' | 'negotiating' | 'client' | 'lost';
export type ContactChannel = 'email' | 'whatsapp' | 'manual';
export type ContactMessageDirection = 'inbound' | 'outbound';

export type ActivityType =
  | 'MESSAGE_SENT'
  | 'FOLLOWUP_CREATED'
  | 'NOTE_CREATED'
  | 'STATUS_CHANGED'
  | 'CAMPAIGN_SENT'
  | 'CONTACT_CREATED'
  | 'MANUAL_INTERACTION';

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

export interface ContactActivity {
  id: string;
  contactId: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
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
