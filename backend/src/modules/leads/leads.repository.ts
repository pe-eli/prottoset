import { getFirestore } from '../../services/firebase.service';
import { Lead, LeadPriority, LeadStatus } from '../../types/leads.types';

function collection() {
  return getFirestore().collection('leads');
}

function migrateLead(raw: any): Lead {
  const hasWebsite = raw.hasWebsite ?? !!raw.website;
  const hasPhone = !!raw.phone;
  let priority: LeadPriority = raw.priority;
  if (!priority || !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
    if (!hasPhone) priority = 'LOW';
    else if (!hasWebsite) priority = 'HIGH';
    else priority = 'MEDIUM';
  }

  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    phone: raw.phone ?? '',
    website: raw.website ?? '',
    websiteFetchError: raw.websiteFetchError ?? false,
    email1: raw.email1 ?? raw.email ?? '',
    email2: raw.email2 ?? '',
    city: raw.city ?? '',
    neighborhood: raw.neighborhood ?? '',
    address: raw.address ?? '',
    hasWebsite,
    rating: raw.rating ?? 0,
    niche: raw.niche ?? '',
    priority,
    status: raw.status ?? 'new',
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function toLead(doc: FirebaseFirestore.DocumentSnapshot): Lead {
  return migrateLead({ ...doc.data(), id: doc.id });
}

function dedupeKey(lead: Lead): string {
  const name = typeof lead.name === 'string' ? lead.name : '';
  const address = typeof lead.address === 'string' ? lead.address : '';
  return `${name.toLowerCase().trim()}|${address.toLowerCase().trim()}`;
}

export const leadsRepository = {
  async getAll(): Promise<Lead[]> {
    const snap = await collection().get();
    return snap.docs.map(toLead);
  },

  async getById(id: string): Promise<Lead | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;
    return toLead(doc);
  },

  async saveMany(newLeads: Lead[]): Promise<Lead[]> {
    const existing = await this.getAll();
    const existingKeys = new Set(existing.map(dedupeKey));
    const unique = newLeads.filter((l) => !existingKeys.has(dedupeKey(l)));

    const db = getFirestore();
    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500);
      const batch = db.batch();
      for (const lead of chunk) {
        const { id, ...data } = lead;
        batch.set(collection().doc(id), data);
      }
      await batch.commit();
    }

    return unique;
  },

  async updateStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    await docRef.update({ status });
    const updated = await docRef.get();
    return toLead(updated);
  },

  async delete(id: string): Promise<boolean> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return false;
    await collection().doc(id).delete();
    return true;
  },
};
