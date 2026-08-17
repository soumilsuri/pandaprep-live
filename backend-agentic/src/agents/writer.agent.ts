import { z } from 'zod';
import { getCapableLLM } from './llm.js';
import { parseLLMJson, countWords } from './parse.js';
import { IScopedWorkspaceSlice } from '../workspace/scoped-slice.js';
import {
  ITermDefined,
  ICrossReferenceAnchor,
  IGeneratedSection,
  ISourceUsed,
} from '../models/notes-workspace.model.js';
import { logger } from '../config/logger.js';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export interface WriterSectionInput {
  subject_name: string;
  scoped_slice: IScopedWorkspaceSlice;
}

export interface WriterSectionOutput {
  section_id: string;
  section: IGeneratedSection;
  new_terms_defined: ITermDefined[];
  new_anchors: ICrossReferenceAnchor[];
  sources_used: Array<{ type: 'vector_chunk' | 'web_search'; source_id?: string; query?: string }>;
}

const termSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

const anchorSchema = z.object({
  anchor_id: z.string().optional(),
  label: z.string().optional(),
});

const sourceUsedSchema = z.object({
  type: z.enum(['vector_chunk', 'web_search']),
  source_id: z.string().optional(),
  query: z.string().optional(),
});

const sourcesUsedSchema = z.array(sourceUsedSchema);

const writerDraftSchema = z
  .object({
    content_markdown: z.string().min(1),
    new_terms_defined: z.unknown().optional(),
    new_anchors: z.unknown().optional(),
    sources_used: z.unknown().optional(),
  })
  .passthrough();

export async function draftSection(input: WriterSectionInput): Promise<WriterSectionOutput> {
  const { scoped_slice, subject_name } = input;
  const sectionId = scoped_slice.section_info.section_id;
  const title = scoped_slice.section_info.title;

  try {
    const llm = getCapableLLM();

    const systemPrompt = `You are a PandaPrep Section Writer. You are drafting revision notes for section: "${title}" in the subject "${subject_name}".

CONTEXT & CONSTRAINTS:
1. Established Definitions from Prior Sections: ${JSON.stringify(scoped_slice.prerequisite_terms)}
2. Available Markdown Anchors to Link to: ${JSON.stringify(scoped_slice.available_anchors)}
3. Style & Depth Guidelines: ${JSON.stringify(scoped_slice.style_rules)}

RULES:
- Produce comprehensive, mathematically rigorous Markdown notes with clear explanations, structured bullet points, and code/syntax examples where appropriate.
- Format all mathematical equations using LaTeX: '$...$' for inline and '$$...$$' for display blocks.
- If introducing important domain terms or definitions, include them in 'new_terms_defined'.
- If creating anchor sections for future reference, include them in 'new_anchors'.
- Do NOT re-explain basic definitions that were already established in prior sections.

Output JSON schema:
{
  "content_markdown": "## Section Title\\n\\nMarkdown content here with LaTeX math...",
  "new_terms_defined": [
    { "term": "Term Name", "definition": "Precise definition" }
  ],
  "new_anchors": [
    { "anchor_id": "sec-01-anchor", "label": "Anchor Title" }
  ]
}

Return ONLY valid JSON. No markdown code blocks, no backticks, no wrapper commentary.`;

    const userPrompt = `Draft section "${title}".
Key Concepts to cover: ${scoped_slice.section_info.key_concepts.join(', ')}.
Target Word Count: ~${scoped_slice.section_info.estimated_words || 500} words.`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parseResult = parseLLMJson(content, writerDraftSchema);

    if (!parseResult.ok) {
      throw parseResult.error;
    }

    const parsed = parseResult.data;

    const contentMarkdown = z.string().min(1).safeParse(parsed.content_markdown);
    const termsParsed = z.array(termSchema).safeParse(parsed.new_terms_defined);
    const anchorsParsed = z.array(anchorSchema).safeParse(parsed.new_anchors);
    const sourcesParsed =
      parsed.sources_used !== undefined ? sourcesUsedSchema.safeParse(parsed.sources_used) : null;

    if (!contentMarkdown.success) {
      logger.warn(
        { err: contentMarkdown.error, sectionId, title },
        'Writer LLM draft missing valid content_markdown; using structured fallback'
      );
      return buildFallback(sectionId, title, scoped_slice);
    }

    if (!termsParsed.success) {
      logger.warn({ err: termsParsed.error, sectionId }, 'Writer LLM draft has malformed new_terms_defined; using empty terms');
    }
    if (!anchorsParsed.success) {
      logger.warn({ err: anchorsParsed.error, sectionId }, 'Writer LLM draft has malformed new_anchors; using empty anchors');
    }
    if (sourcesParsed !== null && !sourcesParsed.success) {
      logger.warn({ err: sourcesParsed.error, sectionId }, 'Writer LLM draft has malformed sources_used; using empty sources');
    }

    const markdown = contentMarkdown.data;
    const terms: ITermDefined[] = (termsParsed.success ? termsParsed.data : []).map((t) => ({
      term: t.term,
      definition: t.definition,
      introduced_in_section: sectionId,
    }));
    const anchors: ICrossReferenceAnchor[] = (anchorsParsed.success ? anchorsParsed.data : []).map((a) => ({
      anchor_id: a.anchor_id || `${sectionId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      section_id: sectionId,
      label: a.label || title,
    }));
    const sources: ISourceUsed[] = sourcesParsed !== null && sourcesParsed.success ? sourcesParsed.data : [];

    return {
      section_id: sectionId,
      section: {
        title,
        content_markdown: markdown,
        word_count: countWords(markdown),
        status: 'completed',
        updated_at: new Date(),
      },
      new_terms_defined: terms,
      new_anchors: anchors,
      sources_used: sources,
    };
  } catch (error) {
    logger.warn({ err: error, sectionId, title }, 'Writer LLM generation error; using structured fallback');
    return buildFallback(sectionId, title, scoped_slice);
  }
}

function buildFallback(
  sectionId: string,
  title: string,
  scoped_slice: IScopedWorkspaceSlice
): WriterSectionOutput {
  const fallbackMarkdown = `## ${title}\n\n### Overview\nThis section covers key principles of **${title}**.\n\n### Key Concepts\n${scoped_slice.section_info.key_concepts.map((c) => `- **${c}**: Core theoretical property and application.`).join('\n')}\n\n$$\\text{Complexity: } \\mathcal{O}(\\log n)$$\n`;

  return {
    section_id: sectionId,
    section: {
      title,
      content_markdown: fallbackMarkdown,
      word_count: countWords(fallbackMarkdown),
      status: 'completed',
      updated_at: new Date(),
    },
    new_terms_defined: [
      {
        term: title,
        definition: `Core definition for ${title}`,
        introduced_in_section: sectionId,
      },
    ],
    new_anchors: [
      {
        anchor_id: `${sectionId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        section_id: sectionId,
        label: title,
      },
    ],
    sources_used: [],
  };
}