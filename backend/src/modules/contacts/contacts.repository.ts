import fs from 'fs';
import path from 'path';
import { Contact, ContactStatus } from '../../types/contacts.types';

const DATA_DIR = path.join(__dirname, '../../../data');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONTACTS_FILE)) {
    fs.writeFileSync(CONTACTS_FILE, '[]', 'utf-8');
  }
}

const VALID_STATUSES: ContactStatus[] = ['new', 'contacted', 'negotiating', 'client', 'lost'];

function readContacts(): Contact[] {
  ensureFile();
  const raw: Partial<Contact>[] = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8'));
  return raw.map((c) => ({
    ...c,
    status: VALID_STATUSES.includes(c.status as ContactStatus) ? (c.status as ContactStatus) : 'contacted',
  })) as Contact[];
}

function writeContacts(contacts: Contact[]): void {
  ensureFile();
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2), 'utf-8');
}

export const contactsRepository = {
  getAll(): Contact[] {
    return readContacts();
  },

  getById(id: string): Contact | null {
    return readContacts().find((c) => c.id === id) || null;
  },

  getByEmail(email: string): Contact | null {
    return readContacts().find((c) => c.email.toLowerCase() === email.toLowerCase()) || null;
  },

  saveMany(newContacts: Contact[]): { saved: Contact[]; duplicates: number } {
    const existing = readContacts();
    const existingEmails = new Set(existing.map((c) => c.email.toLowerCase()));
    const unique = newContacts.filter((c) => !existingEmails.has(c.email.toLowerCase()));
    const updated = [...unique, ...existing];
    writeContacts(updated);
    return { saved: unique, duplicates: newContacts.length - unique.length };
  },

  update(id: string, data: Partial<Pick<Contact, 'name' | 'phone' | 'company' | 'status' | 'notes'>>): Contact | null {
    const contacts = readContacts();
    const contact = contacts.find((c) => c.id === id);
    if (!contact) return null;
    Object.assign(contact, data, { updatedAt: new Date().toISOString() });
    writeContacts(contacts);
    return contact;
  },

  delete(id: string): boolean {
    const contacts = readContacts();
    const filtered = contacts.filter((c) => c.id !== id);
    if (filtered.length === contacts.length) return false;
    writeContacts(filtered);
    return true;
  },
};
