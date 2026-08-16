import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface WebSearchResult {
  title: string;
  snippet: string;
  link?: string;
}

export async function searchWeb(query: string, maxResults = 3): Promise<WebSearchResult[]> {
  if (!query || query.trim().length === 0) return [];

  logger.info({ query }, 'Executing search_web tool...');

  if (!env.SEARCH_API_KEY || !env.CX_KEY) {
    logger.warn({ query }, 'Search API not configured; returning no results');
    return [];
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(
      env.SEARCH_API_KEY
    )}&cx=${encodeURIComponent(env.CX_KEY)}&q=${encodeURIComponent(query)}&num=${maxResults}`;

    const response = await fetch(url);
    if (!response.ok) {
      logger.warn({ status: response.status, query }, 'Google Custom Search returned non-2xx status; returning no results');
      return [];
    }

    const data: any = await response.json();
    const items = data && Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      logger.warn({ query }, 'Google Custom Search returned no items; returning no results');
      return [];
    }

    return items.slice(0, maxResults).map((item: any) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      link: item.link || '',
    }));
  } catch (error) {
    logger.warn({ err: error, query }, 'Google Custom Search request failed; returning no results');
    return [];
  }
}