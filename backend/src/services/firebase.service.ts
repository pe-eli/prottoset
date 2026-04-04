import * as admin from 'firebase-admin';

let _db: admin.firestore.Firestore | null = null;

function normalizePrivateKey(value?: string): string | undefined {
  if (!value) return undefined;

  // Railway/Vercel env values often arrive quoted and with escaped newlines.
  const unquoted = value.replace(/^"([\s\S]*)"$/, '$1').trim();
  const withNewLines = unquoted.replace(/\\n/g, '\n');
  return withNewLines;
}

export function getFirestore(): admin.firestore.Firestore {
  if (!_db) {
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    const required = {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: privateKey,
    };

    const missing = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length) {
      throw new Error(`[Firebase] Missing environment variables: ${missing.join(', ')}`);
    }

    const serviceAccount = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
    };
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    _db = admin.firestore();
    _db.settings({ ignoreUndefinedProperties: true });
    console.log('[Firebase] Firestore initialized');
  }
  return _db;
}
