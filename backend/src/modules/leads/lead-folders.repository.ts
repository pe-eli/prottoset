import { getFirestore } from '../../services/firebase.service';
import { LeadFolder } from '../../types/lead-folders.types';

const PALETTE = ['blue', 'emerald', 'amber', 'violet', 'rose', 'sky', 'teal', 'orange'];

function collection() {
  return getFirestore().collection('leadFolders');
}

function toFolder(doc: FirebaseFirestore.DocumentSnapshot): LeadFolder {
  const d = doc.data() as Omit<LeadFolder, 'id'>;
  return {
    id: doc.id,
    name: d.name ?? '',
    leadIds: d.leadIds ?? [],
    color: d.color ?? 'blue',
    createdAt: d.createdAt ?? new Date().toISOString(),
  };
}

export const leadFoldersRepository = {
  async getAll(): Promise<LeadFolder[]> {
    const snap = await collection().orderBy('createdAt', 'asc').get();
    return snap.docs.map(toFolder);
  },

  async getById(id: string): Promise<LeadFolder | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;
    return toFolder(doc);
  },

  async create(folder: LeadFolder): Promise<LeadFolder> {
    const { id, ...data } = folder;
    // Auto-assign color based on how many folders exist
    const existing = await this.getAll();
    const color = PALETTE[existing.length % PALETTE.length];
    await collection().doc(id).set({ ...data, color, leadIds: [] });
    return { ...folder, color, leadIds: [] };
  },

  async delete(id: string): Promise<boolean> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return false;
    await collection().doc(id).delete();
    return true;
  },

  async addLeads(id: string, leadIds: string[]): Promise<LeadFolder | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const folder = toFolder(doc);
    folder.leadIds = [...new Set([...folder.leadIds, ...leadIds])];
    await docRef.update({ leadIds: folder.leadIds });
    return folder;
  },

  async removeLeads(id: string, leadIds: string[]): Promise<LeadFolder | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const folder = toFolder(doc);
    const toRemove = new Set(leadIds);
    folder.leadIds = folder.leadIds.filter((lid) => !toRemove.has(lid));
    await docRef.update({ leadIds: folder.leadIds });
    return folder;
  },

  /** Remove a lead from all folders (called when a lead is deleted) */
  async removeLead(leadId: string): Promise<void> {
    const folders = await this.getAll();
    const db = getFirestore();
    const batch = db.batch();
    for (const f of folders) {
      if (f.leadIds.includes(leadId)) {
        const updated = f.leadIds.filter((id) => id !== leadId);
        batch.update(collection().doc(f.id), { leadIds: updated });
      }
    }
    await batch.commit();
  },
};
