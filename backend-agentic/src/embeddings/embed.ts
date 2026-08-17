import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface GenerateEmbeddingOptions {
  outputDimensionality?: number;
  task?: 'search_result' | 'question_answering' | 'fact_checking' | 'code_retrieval';
  title?: string;
  isQuery?: boolean;
}

/**
 * Generates an embedding vector using Google's latest `gemini-embedding-2` model.
 * Defaults to 768 dimensions (auto-normalized via Matryoshka Representation Learning)
 * for optimal speed, storage efficiency, and MongoDB Atlas Vector Search compatibility.
 */
export async function generateEmbedding(
  text: string,
  options: GenerateEmbeddingOptions = {}
): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured; cannot generate embeddings');
  }

  const dimensionality = options.outputDimensionality ?? 768;

  // Format text with task prefix recommended for gemini-embedding-2 if task is specified
  let formattedText = text;
  if (options.task) {
    const taskName = options.task.replace('_', ' ');
    if (options.isQuery) {
      formattedText = `task: ${taskName} | query: ${text}`;
    } else {
      const docTitle = options.title || 'none';
      formattedText = `title: ${docTitle} | text: ${text}`;
    }
  }

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: formattedText }],
        },
        output_dimensionality: dimensionality,
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