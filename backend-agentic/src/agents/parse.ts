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
export function parseLLMJson<T>(
  content: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): ParseLLMJsonResult<T> {
  const raw = content.trim();
  let candidate = raw;

  const fenced = candidate.match(/```\s*(?:(?:json|jsonl)\s+|)([\s\S]*?)\s*```/);
  if (fenced) {
    candidate = fenced[1].trim();
  } else if (candidate.startsWith('```')) {
    candidate = candidate.replace(/^```\s*(?:(?:json|jsonl)\s+|)/, '').replace(/```\s*$/, '').trim();
  }

  try {
    const parsed = JSON.parse(candidate);
    const validated = schema.safeParse(parsed);
    if (validated.success) {
      return { ok: true, data: validated.data };
    }
    return { ok: false, error: validated.error, raw };
  } catch (error) {
    return { ok: false, error, raw };
  }
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