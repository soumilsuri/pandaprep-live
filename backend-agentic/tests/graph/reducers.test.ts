import { describe, it, expect } from 'vitest';
import { AgentStateAnnotation } from '../../src/graph/state.js';

interface TermDefined {
  term: string;
  definition: string;
  introduced_in_section: string;
}

interface CrossReferenceAnchor {
  anchor_id: string;
  section_id: string;
  label: string;
}

interface VerificationResult {
  section_id: string;
  iteration: number;
  passed: boolean;
  checks: Record<string, string>;
  issues: unknown[];
}

const spec = AgentStateAnnotation.spec as Record<
  string,
  {
    operator: (curr: unknown, next: unknown) => unknown;
    initialValueFactory?: () => unknown;
  }
>;

const termReducer = (curr: TermDefined[], next: TermDefined[]) =>
  spec.termsDefined.operator(curr, next) as TermDefined[];
const anchorReducer = (curr: CrossReferenceAnchor[], next: CrossReferenceAnchor[]) =>
  spec.crossReferenceAnchors.operator(curr, next) as CrossReferenceAnchor[];
const verificationReducer = (curr: VerificationResult[], next: VerificationResult[]) =>
  spec.verificationResults.operator(curr, next) as VerificationResult[];

const fullTerms: TermDefined[] = [
  { term: 'BST Property', definition: 'Left keys < root < right keys', introduced_in_section: 'sec_01' },
  { term: 'Balance Factor', definition: 'Height difference of subtrees', introduced_in_section: 'sec_02' },
];

const fullAnchors: CrossReferenceAnchor[] = [
  { anchor_id: 'sec-01-bst-property', section_id: 'sec_01', label: 'BST Property' },
  { anchor_id: 'sec-02-balance-factor', section_id: 'sec_02', label: 'Balance Factor' },
];

describe('AgentState channel reducers', () => {
  it('termsDefined replaces instead of appending across writer -> repair rounds', () => {
    const afterWriter = termReducer([], fullTerms);
    expect(afterWriter).toHaveLength(fullTerms.length);

    const afterRepair = termReducer(afterWriter, fullTerms);
    expect(afterRepair).toHaveLength(fullTerms.length);
    expect(afterRepair).toEqual(fullTerms);
  });

  it('crossReferenceAnchors replaces instead of appending across writer -> repair rounds', () => {
    const afterWriter = anchorReducer([], fullAnchors);
    expect(afterWriter).toHaveLength(fullAnchors.length);

    const afterRepair = anchorReducer(afterWriter, fullAnchors);
    expect(afterRepair).toHaveLength(fullAnchors.length);
    expect(afterRepair).toEqual(fullAnchors);
  });

  it('termsDefined behaves like a fresh replace channel (syllabusTopics semantics)', () => {
    const topicReducer = (curr: string[], next: string[]) =>
      spec.syllabusTopics.operator(curr, next) as string[];

    const afterWriter = topicReducer([], ['Unit 1', 'Unit 2']);
    const afterRepair = topicReducer(afterWriter, ['Unit 1', 'Unit 2', 'Unit 3']);

    expect(afterRepair).toEqual(['Unit 1', 'Unit 2', 'Unit 3']);
  });

  it('verificationResults still appends (accumulated history is intended)', () => {
    const first: VerificationResult = {
      section_id: 'sec_01',
      iteration: 1,
      passed: false,
      checks: {},
      issues: [],
    };
    const second: VerificationResult = {
      section_id: 'sec_01',
      iteration: 2,
      passed: true,
      checks: {},
      issues: [],
    };

    const accumulated = verificationReducer([first], [second]);
    expect(accumulated).toHaveLength(2);
    expect(accumulated[1].iteration).toBe(2);
  });
});