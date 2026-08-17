import { getFastLLM } from './llm.js';
import { parseLLMJson } from './parse.js';
import { z } from 'zod';
import {
  IVerificationResult,
  IVerificationIssue,
  ICoverageChecklistItem,
  IGeneratedSection,
  ITermDefined,
  ICrossReferenceAnchor,
} from '../models/notes-workspace.model.js';
import { logger } from '../config/logger.js';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export interface VerifierInput {
  subject_name: string;
  section_id: string;
  section: IGeneratedSection;
  mapped_checklist_items: ICoverageChecklistItem[];
  terms_defined: ITermDefined[];
  available_anchors: ICrossReferenceAnchor[];
  iteration?: number;
}

const IssueSchema = z
  .object({
    check: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    repair_instruction: z.string().optional(),
  })
  .passthrough();

const NormalizedIssueSchema = IssueSchema.pick({
  check: true,
  severity: true,
  description: true,
  repair_instruction: true,
});

const SEVERITY_ALIASES: Record<string, 'low' | 'medium' | 'high'> = {
  critical: 'high',
  severe: 'high',
};

/**
 * Normalizes a raw LLM issue into a validated IVerificationIssue.
 * Unknown/missing severities map to 'medium'; 'critical'/'severe' map to 'high'.
 * Only check/severity/description/repair_instruction survive; unnormalizable
 * entries (non-objects, missing descriptions) are dropped with a log.
 */
function normalizeLLMIssue(raw: unknown): IVerificationIssue | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    logger.warn({ issue: raw }, 'Verifier dropped non-object LLM issue');
    return null;
  }

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.description !== 'string' || candidate.description.trim() === '') {
    logger.warn({ issue: raw }, 'Verifier dropped LLM issue without a description');
    return null;
  }

  let severity: 'low' | 'medium' | 'high';
  if (typeof candidate.severity === 'string' && SEVERITY_ALIASES[candidate.severity.toLowerCase()]) {
    severity = SEVERITY_ALIASES[candidate.severity.toLowerCase()];
  } else if (
    candidate.severity === 'low' ||
    candidate.severity === 'medium' ||
    candidate.severity === 'high'
  ) {
    severity = candidate.severity;
  } else {
    severity = 'medium';
  }

  const normalized = {
    check: typeof candidate.check === 'string' ? candidate.check : 'general',
    severity,
    description: candidate.description,
    ...(typeof candidate.repair_instruction === 'string'
      ? { repair_instruction: candidate.repair_instruction }
      : {}),
  };

  const parsed = NormalizedIssueSchema.safeParse(normalized);
  if (!parsed.success) {
    logger.warn({ issue: raw, error: parsed.error.issues }, 'Verifier dropped unnormalizable LLM issue');
    return null;
  }
  return parsed.data;
}

/**
 * Validates LaTeX syntax deterministically: ensures opening and closing $ and $$ match.
 */
export function checkLatexSyntax(markdown: string): { valid: boolean; issue?: string } {
  // Strip fenced code blocks (```...```) and inline code (`...`) FIRST so that
  // `$$`/`$` appearing inside code snippets never counts as math delimiters.
  let text = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

  // Check display math $$ pairs
  const doubleDollarCount = (text.match(/\$\$/g) || []).length;
  if (doubleDollarCount % 2 !== 0) {
    return {
      valid: false,
      issue: 'Unclosed display LaTeX math block ($$). Odd number of $$ delimiters found.',
    };
  }

  // Remove display math blocks
  text = text.replace(/\$\$[\s\S]*?\$\$/g, '');

  // Check inline math $ pairs (ignoring escaped \$)
  const singleDollarCount = (text.match(/(?<!\\)\$/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    return {
      valid: false,
      issue: 'Unclosed inline LaTeX math block ($). Odd number of $ delimiters found.',
    };
  }

  return { valid: true };
}

/**
 * Checks anchor cross references deterministically: verifies [text](#anchor-id) links exist.
 * A link to the current section's own id is always valid because finalize emits
 * `<a id="${section_id}">` for every section (see finalize-markdown.ts).
 */
export function checkAnchorReferences(
  markdown: string,
  availableAnchors: ICrossReferenceAnchor[],
  currentSectionId: string
): { valid: boolean; brokenAnchors: string[] } {
  const linkMatches = markdown.matchAll(/\[([^\]]+)\]\(#([^)]+)\)/g);
  const broken: string[] = [];

  const knownAnchorIds = new Set(availableAnchors.map((a) => a.anchor_id));
  knownAnchorIds.add(currentSectionId);

  for (const match of linkMatches) {
    const anchorId = match[2];
    if (!knownAnchorIds.has(anchorId)) {
      broken.push(anchorId);
    }
  }

  return {
    valid: broken.length === 0,
    brokenAnchors: broken,
  };
}

export async function verifySection(input: VerifierInput): Promise<IVerificationResult> {
  const {
    section_id,
    section,
    mapped_checklist_items,
    terms_defined,
    available_anchors,
    iteration = 1,
    subject_name,
  } = input;

  const checks: Record<string, 'pass' | 'fail'> = {
    coverage: 'pass',
    missing_topics: 'pass',
    grounding: 'pass',
    terminology: 'pass',
    cross_reference: 'pass',
    latex_syntax: 'pass',
  };

  const issues: IVerificationIssue[] = [];

  // 1. Deterministic Check: LaTeX syntax validation
  const latexResult = checkLatexSyntax(section.content_markdown || '');
  if (!latexResult.valid) {
    checks.latex_syntax = 'fail';
    issues.push({
      check: 'latex_syntax',
      severity: 'medium',
      description: latexResult.issue || 'Malformed LaTeX equation syntax',
      repair_instruction: 'Fix unclosed or mismatched LaTeX $ or $$ blocks.',
    });
  }

  // 2. Deterministic Check: Cross-reference integrity
  const anchorResult = checkAnchorReferences(
    section.content_markdown || '',
    available_anchors,
    section_id
  );
  if (!anchorResult.valid) {
    checks.cross_reference = 'fail';
    issues.push({
      check: 'cross_reference',
      severity: 'medium',
      description: `Referenced anchors do not exist: ${anchorResult.brokenAnchors.join(', ')}`,
      repair_instruction: `Ensure cross-reference links point to valid available anchors: ${available_anchors.map((a) => a.anchor_id).join(', ')}`,
    });
  }

  // 3. LLM Evaluator Check: Semantic coverage, missing topics, and terminology consistency
  try {
    const llm = getFastLLM();

    const systemPrompt = `You are the PandaPrep Automated Verifier Agent.
Your job is to execute contract checks on a generated section of revision notes.

THE 4 EVALUATION CHECKS:
1. Coverage: Does the section sufficiently cover the syllabus requirements mapped to it?
2. Missing Topics: Are any key concepts from the checklist entirely omitted?
3. Terminology: Are defined domain terms used accurately without contradictory definitions?
4. Grounding: Are claims mathematically/factually sound without hallucinated concepts?

Output JSON schema:
{
  "passed": boolean,
  "checks": {
    "coverage": "pass" | "fail",
    "missing_topics": "pass" | "fail",
    "terminology": "pass" | "fail",
    "grounding": "pass" | "fail"
  },
  "issues": [
    {
      "check": "coverage" | "missing_topics" | "terminology" | "grounding",
      "severity": "low" | "medium" | "high",
      "description": "Specific issue description",
      "repair_instruction": "Exact actionable instruction for the Writer to patch the section"
    }
  ]
}

Return ONLY valid JSON. If the section is good and meets all requirements, return passed: true with empty issues array.`;

    const userPrompt = `Subject: ${subject_name}
Section Title: ${section.title} (ID: ${section_id})
Mapped Syllabus Requirements:
${mapped_checklist_items.map((c) => `- [${c.requirement_id}] ${c.syllabus_text}`).join('\n')}

Established Terms: ${JSON.stringify(terms_defined.map((t) => t.term))}

Generated Section Markdown:
${section.content_markdown}`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parsed = parseLLMJson(content, z.unknown());

    if (!parsed.ok) {
      throw parsed.error;
    }

    const rawOutput = parsed.data;
    const output =
      typeof rawOutput === 'object' && rawOutput !== null && !Array.isArray(rawOutput)
        ? (rawOutput as Record<string, unknown>)
        : {};

    // Merge LLM checks with deterministic checks
    const llmChecks =
      typeof output.checks === 'object' && output.checks !== null && !Array.isArray(output.checks)
        ? (output.checks as Record<string, unknown>)
        : undefined;

    if (llmChecks) {
      if (llmChecks.coverage === 'fail') checks.coverage = 'fail';
      if (llmChecks.missing_topics === 'fail') checks.missing_topics = 'fail';
      if (llmChecks.terminology === 'fail') checks.terminology = 'fail';
      if (llmChecks.grounding === 'fail') checks.grounding = 'fail';
    }

    if (Array.isArray(output.issues)) {
      for (const rawIssue of output.issues) {
        const issue = normalizeLLMIssue(rawIssue);
        if (issue) issues.push(issue);
      }
    } else {
      logger.warn({ issues: output.issues }, 'Verifier LLM output "issues" is not an array; ignoring');
    }
  } catch (error) {
    logger.warn({ err: error, section_id }, 'Verifier LLM check encountered error; using deterministic checks');
  }

  const checksPassed = Object.values(checks).every((c) => c === 'pass');
  const hasBlockingIssues = issues.some((i) => i.severity === 'high' || i.severity === 'medium');
  const passed = checksPassed && !hasBlockingIssues;

  return {
    section_id,
    iteration,
    passed,
    checks,
    issues,
  };
}
