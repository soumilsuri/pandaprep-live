import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { WebSearchResult } from '../../src/tools/search-web.js';

describe('searchWeb tool', () => {
  let searchWeb: (query: string, maxResults?: number) => Promise<WebSearchResult[]>;

  beforeAll(async () => {
    vi.stubEnv('SEARCH_API_KEY', 'test-search-key');
    vi.stubEnv('CX_KEY', 'test-cx-key');
    ({ searchWeb } = await import('../../src/tools/search-web.js'));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns [] on non-2xx response and never fabricates results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchWeb('Binary Trees');
    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns [] when the response has no items', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchWeb('Binary Trees');
    expect(results).toEqual([]);
  });

  it('maps successful search items into structured results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { title: 'Trees', snippet: 'About trees', link: 'https://example.com/trees' },
          { title: 'BST', snippet: 'About BST', link: 'https://example.com/bst' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchWeb('Binary Trees');
    expect(results).toEqual([
      { title: 'Trees', snippet: 'About trees', link: 'https://example.com/trees' },
      { title: 'BST', snippet: 'About BST', link: 'https://example.com/bst' },
    ]);
  });

  it('caps results at maxResults', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { title: 'A', snippet: 'a' },
          { title: 'B', snippet: 'b' },
          { title: 'C', snippet: 'c' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchWeb('Binary Trees', 2);
    expect(results).toHaveLength(2);
  });
});