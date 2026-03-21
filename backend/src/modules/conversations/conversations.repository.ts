import { getFirestore } from '../../services/firebase.service';
import { FieldValue } from 'firebase-admin/firestore';
import { Conversation, ConversationMessage } from '../../types/conversations.types';

function collection() {
  return getFirestore().collection('conversations');
}

function toConversation(doc: FirebaseFirestore.DocumentSnapshot): Conversation {
  return { ...doc.data(), id: doc.id } as Conversation;
}

export const conversationsRepository = {
  async getAll(): Promise<Conversation[]> {
    const snap = await collection().get();
    return snap.docs.map(toConversation);
  },

  async getById(id: string): Promise<Conversation | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;
    return toConversation(doc);
  },

  async getByPhone(phone: string): Promise<Conversation | null> {
    const clean = phone.replace(/\D/g, '');
    const snap = await collection()
      .where('phone', '==', clean)
      .where('autoReply', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return toConversation(snap.docs[0]);
  },

  async getByPhoneAny(phone: string): Promise<Conversation | null> {
    const clean = phone.replace(/\D/g, '');
    const snap = await collection()
      .where('phone', '==', clean)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return toConversation(snap.docs[0]);
  },

  async createMany(newConversations: Conversation[]): Promise<Conversation[]> {
    const db = getFirestore();
    for (let i = 0; i < newConversations.length; i += 500) {
      const chunk = newConversations.slice(i, i + 500);
      const batch = db.batch();
      for (const conv of chunk) {
        const { id, ...data } = conv;
        batch.set(collection().doc(id), data);
      }
      await batch.commit();
    }
    return newConversations;
  },

  async update(id: string, data: Partial<Conversation>): Promise<Conversation | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await docRef.update({ ...clean, updatedAt: new Date().toISOString() });
    const updated = await docRef.get();
    return toConversation(updated);
  },

  async appendMessage(id: string, message: ConversationMessage): Promise<Conversation | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    await docRef.update({
      messages: FieldValue.arrayUnion(message),
      updatedAt: new Date().toISOString(),
    });
    const updated = await docRef.get();
    return toConversation(updated);
  },

  async advanceStage(
    id: string,
    stage: Conversation['stage'],
    autoReply: boolean,
    message: ConversationMessage,
  ): Promise<Conversation | null> {
    const docRef = collection().doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    await docRef.update({
      stage,
      autoReply,
      messages: FieldValue.arrayUnion(message),
      updatedAt: new Date().toISOString(),
    });
    const updated = await docRef.get();
    return toConversation(updated);
  },

  async delete(id: string): Promise<boolean> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return false;
    await collection().doc(id).delete();
    return true;
  },
};
