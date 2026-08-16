import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Generates an embedding vector for a single text using Google Gemini Embedding API.
 * Throws on any failure so callers never treat a zero/empty vector as valid.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured; cannot generate embeddings');
  }

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn({ status: response.status, errText }, 'Gemini embedding API error');
      throw new Error(`Gemini embedding API error: ${response.status}`);
    }

    const data: any = await response.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Gemini embedding response missing embedding values');
    }
    return values;
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate embedding with Gemini');
    throw error;
  }
}

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}