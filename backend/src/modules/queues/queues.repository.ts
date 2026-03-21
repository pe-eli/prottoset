import { getFirestore } from '../../services/firebase.service';
import { PhoneQueue } from '../../types/queues.types';

function collection() {
  return getFirestore().collection('queues');
}

function toQueue(doc: FirebaseFirestore.DocumentSnapshot): PhoneQueue {
  return { ...doc.data(), id: doc.id } as PhoneQueue;
}

export const queuesRepository = {
  async getAll(): Promise<PhoneQueue[]> {
    const snap = await collection().get();
    return snap.docs.map(toQueue);
  },

  async getById(id: string): Promise<PhoneQueue | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;
    return toQueue(doc);
  },

  async create(queue: PhoneQueue): Promise<PhoneQueue> {
    const { id, ...data } = queue;
    await collection().doc(id).set(data);
    return queue;
  },

  async delete(id: string): Promise<boolean> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return false;
    await collection().doc(id).delete();
    return true;
  },

  async addPhones(id: string, phones: string[]): Promise<PhoneQueue | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const queue = toQueue(doc);
    queue.phones = [...new Set([...queue.phones, ...phones])];
    await docRef.update({ phones: queue.phones });
    return queue;
  },

  async removePhone(id: string, phone: string): Promise<PhoneQueue | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const queue = toQueue(doc);
    queue.phones = queue.phones.filter((p) => p !== phone);
    await docRef.update({ phones: queue.phones });
    return queue;
  },

  async rename(id: string, name: string): Promise<PhoneQueue | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    await docRef.update({ name });
    return { ...toQueue(doc), name };
  },

  async merge(sourceIds: string[], targetName: string): Promise<PhoneQueue | null> {
    const db = getFirestore();
    return db.runTransaction(async (tx) => {
      const sources: PhoneQueue[] = [];
      for (const sid of sourceIds) {
        const doc = await tx.get(collection().doc(sid));
        if (doc.exists) sources.push(toQueue(doc));
      }
      if (sources.length < 2) return null;

      const allPhones = [...new Set(sources.flatMap((q) => q.phones))];
      for (let i = 1; i < sources.length; i++) {
        tx.delete(collection().doc(sources[i].id));
      }

      const merged: PhoneQueue = {
        id: sources[0].id,
        name: targetName,
        phones: allPhones,
        createdAt: sources[0].createdAt,
      };
      tx.set(collection().doc(merged.id), { name: targetName, phones: allPhones, createdAt: merged.createdAt });
      return merged;
    });
  },
};
