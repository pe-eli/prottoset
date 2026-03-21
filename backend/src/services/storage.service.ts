import { getFirestore } from './firebase.service';
import { Quote } from '../types/quote.types';

function collection() {
  return getFirestore().collection('quotes');
}

export const storageService = {
  async getAll(): Promise<Quote[]> {
    const snap = await collection().get();
    return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Quote);
  },

  async getById(id: string): Promise<Quote | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;
    return { ...doc.data(), id: doc.id } as Quote;
  },

  async save(quote: Quote): Promise<void> {
    const { id, ...data } = quote;
    await collection().doc(id).set(data);
  },
};
