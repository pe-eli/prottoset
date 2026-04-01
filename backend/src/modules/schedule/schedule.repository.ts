import { getFirestore } from '../../services/firebase.service';
import { ScheduleItem, CreateScheduleItemParams } from '../../types/schedule.types';
import { v4 as uuid } from 'uuid';

const collection = () => getFirestore().collection('schedule');

function toItem(doc: FirebaseFirestore.DocumentSnapshot): ScheduleItem {
  const d = doc.data()!;
  return {
    id: doc.id,
    title: d.title ?? '',
    category: d.category ?? 'prottocode',
    startTime: d.startTime ?? '09:00',
    endTime: d.endTime ?? '10:00',
    date: d.date ?? undefined,
    recurrence: d.recurrence ?? undefined,
    createdAt: d.createdAt ?? '',
    updatedAt: d.updatedAt ?? '',
  };
}

export const scheduleRepository = {
  async getAll(): Promise<ScheduleItem[]> {
    const snap = await collection().orderBy('createdAt', 'desc').get();
    return snap.docs.map(toItem);
  },

  async getById(id: string): Promise<ScheduleItem | null> {
    const doc = await collection().doc(id).get();
    return doc.exists ? toItem(doc) : null;
  },

  async create(params: CreateScheduleItemParams): Promise<ScheduleItem> {
    const id = uuid();
    const now = new Date().toISOString();
    const item: ScheduleItem = {
      id,
      ...params,
      createdAt: now,
      updatedAt: now,
    };
    const { id: docId, ...data } = item;
    await collection().doc(docId).set(data);
    return item;
  },

  async update(id: string, params: Partial<CreateScheduleItemParams>): Promise<ScheduleItem | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;

    await collection().doc(id).update({
      ...params,
      updatedAt: new Date().toISOString(),
    });

    const updated = await collection().doc(id).get();
    return toItem(updated);
  },

  async delete(id: string): Promise<boolean> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return false;
    await collection().doc(id).delete();
    return true;
  },
};
