import { z } from 'zod';
import { getCapableLLM } from './llm.js';
import { parseLLMJson, countWords } from './parse.js';
import { IScopedWorkspaceSlice } from '../workspace/scoped-slice.js';
import {
  IGeneratedSection,
  IVerificationIssue,
  ITermDefined,
  ICrossReferenceAnchor,
} from '../models/notes-workspace.model.js';
import { logger } from '../config/logger.js';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export interface RepairSectionInput {
  subject_name: string;
  scoped_slice: IScopedWorkspaceSlice;
  existing_section: IGeneratedSection;
  issues: IVerificationIssue[];
}

export interface RepairSectionOutput {
  section_id: string;
  section: IGeneratedSection;
  new_terms_defined: ITermDefined[];
  new_anchors: ICrossReferenceAnchor[];
}

const termSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

const anchorSchema = z.object({
  anchor_id: z.string().optional(),
  label: z.string().optional(),
});

const repairDraftSchema = z
  .object({
    content_markdown: z.string().min(1),
    new_terms_defined: z.unknown().optional(),
    new_anchors: z.unknown().optional(),
  })
  .passthrough();

export async function repairSection(input: RepairSectionInput): Promise<RepairSectionOutput> {
  const { scoped_slice, existing_section, issues, subject_name } = input;
  const sectionId = scoped_slice.section_info.section_id;
  const title = scoped_slice.section_info.title;

  try {
    const llm = getCapableLLM();

    const formattedIssues = issues
      .map((iss, i) => {
        const check = (iss.check ?? 'general').toUpperCase();
        const severity = iss.severity ?? 'medium';
        const description = iss.description ?? 'No description provided.';
        const repairInstruction = iss.repair_instruction ?? 'Apply targeted fixes to resolve the issue.';
        return `${i + 1}. [${check} - ${severity}] ${description}\n   Repair Instruction: ${repairInstruction}`;
      })
      .join('\n');

    const systemPrompt = `You are a PandaPrep Section Repair Specialist.
You are given a section of revision notes that failed automated contract checks.
Your job is to apply targeted repairs to fix the identified issues while preserving the overall tone, LaTeX rigor, and formatting.

ISSUES TO RESOLVE:
${formattedIssues}

GUIDELINES:
- Directly incorporate the missing content or fix syntax/formatting issues.
- Maintain LaTeX math precision ($...$ and $$...$$).
- Output the complete, revised Markdown for the section.

Output JSON schema:
{
  "content_markdown": "## Section Title\\n\\nRevised markdown...",
  "new_terms_defined": [
    { "term": "New Term", "definition": "Definition" }
  ],
  "new_anchors": [
    { "anchor_id": "anchor-id", "label": "Anchor Title" }
  ]
}

Return ONLY valid JSON. No markdown backticks, no explanations.`;

    const userPrompt = `Subject: ${subject_name}
Section: "${title}" (ID: ${sectionId})
Existing Content:
${existing_section.content_markdown}`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parseResult = parseLLMJson(content, repairDraftSchema);

    if (!parseResult.ok) {
      throw parseResult.error;
    }

    const parsed = parseResult.data;

    const contentMarkdown = z.string().min(1).safeParse(parsed.content_markdown);
    const termsParsed = z.array(termSchema).safeParse(parsed.new_terms_defined);
    const anchorsParsed = z.array(anchorSchema).safeParse(parsed.new_anchors);

    if (!contentMarkdown.success) {
      logger.warn(
        { err: contentMarkdown.error, sectionId },
        'Repair LLM draft missing valid content_markdown; preserving existing section'
      );
      return {
        section_id: sectionId,
        section: existing_section,
        new_terms_defined: [],
        new_anchors: [],
      };
    }

    if (!termsParsed.success) {
      logger.warn({ err: termsParsed.error, sectionId }, 'Repair LLM draft has malformed new_terms_defined; using empty terms');
    }
    if (!anchorsParsed.success) {
      logger.warn({ err: anchorsParsed.error, sectionId }, 'Repair LLM draft has malformed new_anchors; using empty anchors');
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
    };
  } catch (error) {
    logger.warn({ err: error, sectionId }, 'Repair Agent encountered error; preserving existing section');
    return {
      section_id: sectionId,
      section: existing_section,
      new_terms_defined: [],
      new_anchors: [],
    };
  }
}
