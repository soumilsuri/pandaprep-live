export interface EvalMetricScores {
  completeness: number; // 0.0 to 1.0 (S_comp)
  faithfulness: number; // 0.0 to 1.0 (S_faith)
  coherence: number;    // 0.0 to 1.0 (S_cohere)
  syntax: number;       // 0.0 to 1.0 (S_syntax)
}

export interface SingleEvalResult {
  id: string;
  category: string;
  subjectName: string;
  scores: EvalMetricScores;
  compositeScore: number; // 0.0 to 100.0 (Q_i)
  passed: boolean;
  notes?: string[];
}

/**
 * Deterministic balanced-stack algorithm checking math delimiters ($ and $$)
 * and LaTeX environment blocks (\begin{...} and \end{...}).
 */
export function checkLatexSyntax(markdown: string): { valid: boolean; errors: string[] } {
  if (!markdown) return { valid: true, errors: [] };

  const errors: string[] = [];

  // 1. Check double dollar delimiters ($$)
  // Remove escaped dollar signs first
  const sanitized = markdown.replace(/\\\$/g, '');

  let doubleDollarOpen = false;
  let doubleDollarIndex = -1;

  // Track double dollar positions
  const ddRegex = /\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = ddRegex.exec(sanitized)) !== null) {
    if (!doubleDollarOpen) {
      doubleDollarOpen = true;
      doubleDollarIndex = match.index;
    } else {
      doubleDollarOpen = false;
      doubleDollarIndex = -1;
    }
  }

  if (doubleDollarOpen) {
    errors.push(`Unclosed display math delimiter ($$) starting at position ${doubleDollarIndex}`);
  }

  // 2. Check single dollar delimiters ($) excluding $$ blocks
  // Replace all $$...$$ blocks with placeholders to avoid false positives on single $
  const withoutDisplayMath = sanitized.replace(/\$\$[\s\S]*?\$\$/g, ' ');

  // Count unescaped single dollars
  const singleDollarMatches = withoutDisplayMath.match(/(?<!\$)\$(?!\$)/g);
  if (singleDollarMatches && singleDollarMatches.length % 2 !== 0) {
    errors.push(`Mismatched inline math delimiter ($): found ${singleDollarMatches.length} single dollar signs (odd count)`);
  }

  // 3. Check balanced \begin{env} and \end{env}
  const envStack: { env: string; index: number }[] = [];
  const envRegex = /\\(begin|end)\{([a-zA-Z0-9*]+)\}/g;

  while ((match = envRegex.exec(sanitized)) !== null) {
    const type = match[1];
    const envName = match[2];

    if (type === 'begin') {
      envStack.push({ env: envName, index: match.index });
    } else if (type === 'end') {
      if (envStack.length === 0) {
        errors.push(`Found \\end{${envName}} without matching \\begin at position ${match.index}`);
      } else {
        const top = envStack.pop()!;
        if (top.env !== envName) {
          errors.push(`Mismatched LaTeX environment: expected \\end{${top.env}} but found \\end{${envName}} at position ${match.index}`);
        }
      }
    }
  }

  while (envStack.length > 0) {
    const unclosed = envStack.pop()!;
    errors.push(`Unclosed LaTeX environment: \\begin{${unclosed.env}} at position ${unclosed.index}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates LaTeX syntax score S_syntax (0.0 to 1.0).
 */
export function calculateLatexSyntaxScore(markdown: string): number {
  const result = checkLatexSyntax(markdown);
  if (result.valid) return 1.0;
  // Deduct 0.25 per error, capped at 0.0
  return Math.max(0.0, 1.0 - result.errors.length * 0.25);
}

/**
 * Calculates Completeness score S_comp (0.0 to 1.0).
 * Programmatically checks coverage checklist fulfillment and expected keyword presence.
 */
export function calculateCompletenessScore(
  state: Record<string, any>,
  expectedTopics?: string[]
): number {
  const checklist = Array.isArray(state.coverageChecklist) ? state.coverageChecklist : [];
  const finalMarkdown = typeof state.finalMarkdown === 'string' ? state.finalMarkdown : '';

  let checklistRatio = 1.0;
  if (checklist.length > 0) {
    const verifiedOrDrafted = checklist.filter(
      (item: any) => item.status === 'verified' || item.status === 'drafted'
    ).length;
    checklistRatio = verifiedOrDrafted / checklist.length;
  }

  let topicRatio = 1.0;
  if (expectedTopics && expectedTopics.length > 0 && finalMarkdown.length > 0) {
    const lowerMarkdown = finalMarkdown.toLowerCase();
    const foundTopics = expectedTopics.filter((topic) =>
      lowerMarkdown.includes(topic.toLowerCase())
    ).length;
    topicRatio = foundTopics / expectedTopics.length;
  }

  // Deduct penalty if there are outstanding gaps
  const outstandingGaps = Array.isArray(state.outstandingGaps) ? state.outstandingGaps : [];
  const gapPenalty = outstandingGaps.length > 0 ? Math.min(0.2, outstandingGaps.length * 0.05) : 0;

  const score = checklistRatio * 0.6 + topicRatio * 0.4 - gapPenalty;
  return Math.min(1.0, Math.max(0.0, Number(score.toFixed(4))));
}

/**
 * Calculates Faithfulness score S_faith (0.0 to 1.0).
 * Measures grounding, citation support, and absence of verifier grounding issues.
 */
export function calculateFaithfulnessScore(state: Record<string, any>): number {
  const verificationResults = Array.isArray(state.verificationResults)
    ? state.verificationResults
    : [];

  if (verificationResults.length === 0) {
    // If state has generated content without verification errors, assign baseline 1.0
    return state.finalMarkdown ? 1.0 : 0.8;
  }

  let totalSections = verificationResults.length;
  let groundedSections = 0;
  let groundingIssues = 0;

  for (const res of verificationResults) {
    if (res.checks && (res.checks.grounding === 'pass' || res.checks.grounding === undefined)) {
      groundedSections++;
    }
    if (Array.isArray(res.issues)) {
      const groundingErrors = res.issues.filter((i: any) => i.check === 'grounding');
      groundingIssues += groundingErrors.length;
    }
  }

  const baseRatio = totalSections > 0 ? groundedSections / totalSections : 1.0;
  const issuePenalty = groundingIssues * 0.1;

  const score = Math.max(0.0, Math.min(1.0, baseRatio - issuePenalty));
  return Number(score.toFixed(4));
}

/**
 * Calculates Coherence score S_cohere (0.0 to 1.0).
 * Audits term definition consistency, cross-reference anchor validity, and style alignment.
 */
export function calculateCoherenceScore(state: Record<string, any>): number {
  const terms = Array.isArray(state.termsDefined) ? state.termsDefined : [];
  const anchors = Array.isArray(state.crossReferenceAnchors) ? state.crossReferenceAnchors : [];
  const finalMarkdown = typeof state.finalMarkdown === 'string' ? state.finalMarkdown : '';

  let termConsistency = 1.0;
  if (terms.length > 0) {
    // Check if terms are defined uniquely without conflicting definitions
    const termMap = new Map<string, string>();
    let conflicts = 0;
    for (const t of terms) {
      const key = t.term?.toLowerCase();
      if (key) {
        if (termMap.has(key) && termMap.get(key) !== t.definition) {
          conflicts++;
        } else {
          termMap.set(key, t.definition);
        }
      }
    }
    termConsistency = Math.max(0.0, 1.0 - (conflicts / terms.length));
  }

  let anchorResolution = 1.0;
  if (anchors.length > 0 && finalMarkdown.length > 0) {
    const validAnchors = anchors.filter((a) =>
      finalMarkdown.includes(a.anchor_id) || finalMarkdown.includes(a.label)
    ).length;
    anchorResolution = validAnchors / anchors.length;
  }

  const score = termConsistency * 0.5 + anchorResolution * 0.5;
  return Math.min(1.0, Math.max(0.0, Number(score.toFixed(4))));
}

/**
 * Calculates composite single-note score Q_i (0 to 100%).
 * Q_i = (0.35 * S_comp + 0.25 * S_faith + 0.20 * S_cohere + 0.20 * S_syntax) * 100
 */
export function calculateSingleScore(metrics: EvalMetricScores): number {
  const composite =
    0.35 * metrics.completeness +
    0.25 * metrics.faithfulness +
    0.20 * metrics.coherence +
    0.20 * metrics.syntax;

  return Number((composite * 100).toFixed(2));
}

/**
 * Calculates aggregate score Q_aggregate across all evaluated syllabi.
 */
export function calculateAggregateScore(scores: number[]): number {
  if (!scores || scores.length === 0) return 0.0;
  const sum = scores.reduce((acc, curr) => acc + curr, 0);
  return Number((sum / scores.length).toFixed(2));
}
