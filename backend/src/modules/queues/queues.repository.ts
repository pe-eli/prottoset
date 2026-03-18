import fs from 'fs';
import path from 'path';
import { PhoneQueue } from '../../types/queues.types';

const DATA_DIR = path.join(__dirname, '../../../data');
const QUEUES_FILE = path.join(DATA_DIR, 'queues.json');

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(QUEUES_FILE)) {
    fs.writeFileSync(QUEUES_FILE, '[]', 'utf-8');
  }
}

function readQueues(): PhoneQueue[] {
  ensureFile();
  return JSON.parse(fs.readFileSync(QUEUES_FILE, 'utf-8'));
}

function writeQueues(queues: PhoneQueue[]): void {
  ensureFile();
  fs.writeFileSync(QUEUES_FILE, JSON.stringify(queues, null, 2), 'utf-8');
}

export const queuesRepository = {
  getAll(): PhoneQueue[] {
    return readQueues();
  },

  getById(id: string): PhoneQueue | null {
    return readQueues().find((q) => q.id === id) || null;
  },

  create(queue: PhoneQueue): PhoneQueue {
    const queues = readQueues();
    queues.push(queue);
    writeQueues(queues);
    return queue;
  },

  delete(id: string): boolean {
    const queues = readQueues();
    const filtered = queues.filter((q) => q.id !== id);
    if (filtered.length === queues.length) return false;
    writeQueues(filtered);
    return true;
  },

  addPhones(id: string, phones: string[]): PhoneQueue | null {
    const queues = readQueues();
    const queue = queues.find((q) => q.id === id);
    if (!queue) return null;
    queue.phones = [...new Set([...queue.phones, ...phones])];
    writeQueues(queues);
    return queue;
  },

  removePhone(id: string, phone: string): PhoneQueue | null {
    const queues = readQueues();
    const queue = queues.find((q) => q.id === id);
    if (!queue) return null;
    queue.phones = queue.phones.filter((p) => p !== phone);
    writeQueues(queues);
    return queue;
  },

  rename(id: string, name: string): PhoneQueue | null {
    const queues = readQueues();
    const queue = queues.find((q) => q.id === id);
    if (!queue) return null;
    queue.name = name;
    writeQueues(queues);
    return queue;
  },

  merge(sourceIds: string[], targetName: string): PhoneQueue | null {
    const queues = readQueues();
    const sources = queues.filter((q) => sourceIds.includes(q.id));
    if (sources.length < 2) return null;

    const allPhones = [...new Set(sources.flatMap((q) => q.phones))];
    const remaining = queues.filter((q) => !sourceIds.includes(q.id));

    const merged: PhoneQueue = {
      id: sources[0].id,
      name: targetName,
      phones: allPhones,
      createdAt: sources[0].createdAt,
    };

    remaining.push(merged);
    writeQueues(remaining);
    return merged;
  },
};
