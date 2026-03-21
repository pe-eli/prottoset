import { getFirestore } from '../../services/firebase.service';
import { Contact, ContactStatus } from '../../types/contacts.types';

const VALID_STATUSES: ContactStatus[] = ['new', 'contacted', 'negotiating', 'client', 'lost'];

function collection() {
  return getFirestore().collection('contacts');
}

function sanitizeStatus(status: string | undefined): ContactStatus {
  return VALID_STATUSES.includes(status as ContactStatus) ? (status as ContactStatus) : 'contacted';
}

function toContact(doc: FirebaseFirestore.DocumentSnapshot): Contact {
  const data = doc.data() as Contact;
  return { ...data, id: doc.id, status: sanitizeStatus(data.status) };
}

export const contactsRepository = {
  async getAll(): Promise<Contact[]> {
    const snap = await collection().get();
    return snap.docs.map(toContact);
  },

  async getById(id: string): Promise<Contact | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;
    return toContact(doc);
  },

  async getByEmail(email: string): Promise<Contact | null> {
    const snap = await collection()
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    if (snap.empty) return null;
    return toContact(snap.docs[0]);
  },

  async saveMany(newContacts: Contact[]): Promise<{ saved: Contact[]; duplicates: number }> {
    const existing = await this.getAll();
    const existingEmails = new Set(existing.filter((c) => c.email).map((c) => c.email.toLowerCase()));
    const existingPhones = new Set(existing.filter((c) => c.phone).map((c) => c.phone));
    const unique = newContacts.filter((c) => {
      if (c.email) return !existingEmails.has(c.email.toLowerCase());
      if (c.phone) return !existingPhones.has(c.phone);
      return true;
    });

    const db = getFirestore();
    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500);
      const batch = db.batch();
      for (const contact of chunk) {
        const { id, ...data } = contact;
        batch.set(collection().doc(id), data);
      }
      await batch.commit();
    }

    return { saved: unique, duplicates: newContacts.length - unique.length };
  },

  async update(id: string, data: Partial<Pick<Contact, 'name' | 'phone' | 'company' | 'status' | 'notes' | 'channel' | 'lastMessage' | 'lastMessageAt'>>): Promise<Contact | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await docRef.update({ ...clean, updatedAt: new Date().toISOString() });
    const updated = await docRef.get();
    return toContact(updated);
  },

  async delete(id: string): Promise<boolean> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return false;
    await collection().doc(id).delete();
    return true;
  },
};
