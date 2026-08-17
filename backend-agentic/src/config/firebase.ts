import admin from 'firebase-admin';
import { env } from './env.js';
import { logger } from './logger.js';

if (!admin.apps.length) {
  try {
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      logger.info('Firebase Admin SDK initialized successfully');
    } else {
      logger.warn('Firebase credentials not fully provided; Firebase Admin skipped.');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Firebase Admin SDK');
  }
}

export { admin };
