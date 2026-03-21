import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getFirestore } from '../services/firebase.service';

const DATA_DIR = path.join(__dirname, '../../data');

interface MigrationConfig {
  file: string;
  collection: string;
}

const COLLECTIONS: MigrationConfig[] = [
  { file: 'contacts.json', collection: 'contacts' },
  { file: 'leads.json', collection: 'leads' },
  { file: 'queues.json', collection: 'queues' },
  { file: 'conversations.json', collection: 'conversations' },
  { file: 'quotes.json', collection: 'quotes' },
];

async function migrateCollection(config: MigrationConfig) {
  const filePath = path.join(DATA_DIR, config.file);
  if (!fs.existsSync(filePath)) {
    console.log(`[Skip] ${config.file} not found`);
    return;
  }

  const data: any[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (data.length === 0) {
    console.log(`[Skip] ${config.file} is empty`);
    return;
  }

  const db = getFirestore();
  const collRef = db.collection(config.collection);

  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      const { id, ...rest } = item;
      if (!id) {
        console.warn(`[Warn] Item without id in ${config.file}, skipping`);
        continue;
      }
      batch.set(collRef.doc(id), rest);
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  [${config.collection}] ${written}/${data.length}`);
  }

  console.log(`  [Done] ${config.collection}: ${written} documents`);
}

async function main() {
  console.log('=== Prottoset: JSON -> Firestore Migration ===\n');

  for (const config of COLLECTIONS) {
    await migrateCollection(config);
  }

  console.log('\n=== Migration complete ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
