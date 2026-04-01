import { getFirestore } from '../../services/firebase.service';
import { DailyEntry, CreateDailyEntryParams } from '../../types/productivity.types';
import { v4 as uuid } from 'uuid';

const collection = () => getFirestore().collection('productivity');

function toEntry(doc: FirebaseFirestore.DocumentSnapshot): DailyEntry {
  const d = doc.data()!;
  return {
    id: doc.id,
    date: d.date ?? '',
    week: d.week ?? '',
    prottocodeHours: d.prottocodeHours ?? 0,
    aluraHours: d.aluraHours ?? 0,
    dimourasHours: d.dimourasHours ?? 0,
    focus: d.focus ?? '',
    completion: d.completion ?? 0,
    notes: d.notes ?? '',
    rating: d.rating ?? 'average',
    createdAt: d.createdAt ?? '',
    updatedAt: d.updatedAt ?? '',
  };
}

function getWeekString(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + startOfYear.getDay()) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export const productivityRepository = {
  async getAll(): Promise<DailyEntry[]> {
    const snap = await collection().orderBy('date', 'desc').get();
    return snap.docs.map(toEntry);
  },

  async getById(id: string): Promise<DailyEntry | null> {
    const doc = await collection().doc(id).get();
    return doc.exists ? toEntry(doc) : null;
  },

  async getByWeek(week: string): Promise<DailyEntry[]> {
    const snap = await collection().where('week', '==', week).orderBy('date', 'asc').get();
    return snap.docs.map(toEntry);
  },

  async create(params: CreateDailyEntryParams): Promise<DailyEntry> {
    const id = uuid();
    const now = new Date().toISOString();
    const entry: DailyEntry = {
      id,
      ...params,
      week: getWeekString(params.date),
      createdAt: now,
      updatedAt: now,
    };
    const { id: docId, ...data } = entry;
    await collection().doc(docId).set(data);
    return entry;
  },

  async update(id: string, params: Partial<CreateDailyEntryParams>): Promise<DailyEntry | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;

    const updates: Record<string, unknown> = {
      ...params,
      updatedAt: new Date().toISOString(),
    };
    if (params.date) {
      updates.week = getWeekString(params.date);
    }
    await collection().doc(id).update(updates);

    const updated = await collection().doc(id).get();
    return toEntry(updated);
  },

  async delete(id: string): Promise<boolean> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return false;
    await collection().doc(id).delete();
    return true;
  },
};
