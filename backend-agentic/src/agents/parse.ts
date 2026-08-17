import { z } from 'zod';

export type ParseLLMJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown; raw: string };

export const MAX_NOTES_CONTEXT_CHARS = 30000;

/**
 * Central helper for parsing LLM JSON output (SG-001).
 * Robustly strips markdown fences (with or without a language tag,
 * including the previously-missed "``` json" with a space) and validates
 * the parsed payload against a zod schema.
 */
function tryParseJson<T>(str: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): ParseLLMJsonResult<T> | null {
  try {
    const parsed = JSON.parse(str);
    const validated = schema.safeParse(parsed);
    if (validated.success) return { ok: true, data: validated.data };
    return { ok: false, error: validated.error, raw: str };
  } catch (err) {
    // If syntax error is due to bad escape sequences (e.g. unescaped LaTeX backslashes \alpha, \times)
    try {
      const repaired = str.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
      const parsed = JSON.parse(repaired);
      const validated = schema.safeParse(parsed);
      if (validated.success) return { ok: true, data: validated.data };
      return { ok: false, error: validated.error, raw: str };
    } catch {
      return null;
    }
  }
}

/**
 * Central helper for parsing LLM JSON output (SG-001).
 * Robustly strips markdown fences, handles nested code blocks, and validates
 * the parsed payload against a zod schema.
 */
export function parseLLMJson<T>(
  content: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): ParseLLMJsonResult<T> {
  const raw = content.trim();
  let candidate = raw;

  // 1. Try stripping outer fences from first ``` to last ```
  const firstFence = candidate.indexOf('```');
  const lastFence = candidate.lastIndexOf('```');
  if (firstFence !== -1 && lastFence > firstFence) {
    const unwrapped = candidate
      .slice(firstFence, lastFence)
      .replace(/^```\s*(?:(?:json|jsonl)\s+|)/i, '')
      .trim();
    const result = tryParseJson(unwrapped, schema);
    if (result && result.ok) return result;
  }

  // 2. Try extracting from first '{' to last '}'
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = candidate.slice(firstBrace, lastBrace + 1);
    const result = tryParseJson(jsonSubstring, schema);
    if (result && result.ok) return result;
  }

  const directResult = tryParseJson(candidate, schema);
  if (directResult) return directResult;

  try {
    JSON.parse(candidate);
  } catch (error) {
    return { ok: false, error, raw };
  }

  return { ok: false, error: new Error('Failed to parse and validate LLM JSON'), raw };
}

/**
 * Counts words in generated markdown, excluding display math ($$...$$),
 * inline math ($...$) and fenced code blocks so LaTeX delimiters do not
 * inflate the count (SG-008).
 */
export function countWords(markdown: string): number {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ');
  const withoutMath = withoutCode.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$\n]*\$/g, ' ');
  return withoutMath.split(/\s+/).filter((w) => w.length > 0).length;
}