import { describe, it, expect } from 'vitest';
import {
  checkLatexSyntax,
  calculateLatexSyntaxScore,
  calculateCompletenessScore,
  calculateFaithfulnessScore,
  calculateCoherenceScore,
  calculateSingleScore,
  calculateAggregateScore,
} from '../../evals/scoring.js';

describe('Pillar 3: Evaluation Frameworks & Scoring Rubrics', () => {
  describe('checkLatexSyntax & calculateLatexSyntaxScore', () => {
    it('passes on valid inline math, display math, and balanced environments', () => {
      const validMarkdown = `
# Organic Chemistry Notes

Let the reaction rate be $r = k[A]^2$.
The equilibrium constant is given by:
$$K_{eq} = \\frac{[C]^c [D]^d}{[A]^a [B]^b}$$

\\begin{align}
\\Delta G &= \\Delta H - T\\Delta S \\\\
\\Delta G^\\circ &= -RT \\ln K
\\end{align}
`;
      const result = checkLatexSyntax(validMarkdown);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(calculateLatexSyntaxScore(validMarkdown)).toBe(1.0);
    });

    it('detects unclosed display math ($$) delimiters', () => {
      const brokenMarkdown = `
The equation is:
$$\\text{Work} = \\int P dV
And the temperature increases.
`;
      const result = checkLatexSyntax(brokenMarkdown);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unclosed display math'))).toBe(true);
      expect(calculateLatexSyntaxScore(brokenMarkdown)).toBeLessThan(1.0);
    });

    it('detects mismatched or unclosed LaTeX environments', () => {
      const brokenEnv = `
\\begin{matrix}
1 & 0 \\\\
0 & 1
\\end{align}
`;
      const result = checkLatexSyntax(brokenEnv);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Mismatched LaTeX environment'))).toBe(true);
    });
  });

  describe('calculateCompletenessScore', () => {
    it('returns 1.0 when all checklist items are verified and topics are present', () => {
      const state = {
        coverageChecklist: [
          { requirement_id: 'r1', status: 'verified' },
          { requirement_id: 'r2', status: 'verified' },
        ],
        finalMarkdown: 'Detailed study of Dijkstra algorithm and Bellman-Ford shortest paths.',
        outstandingGaps: [],
      };

      const score = calculateCompletenessScore(state, ['Dijkstra', 'Bellman-Ford']);
      expect(score).toBe(1.0);
    });

    it('penalizes missing checklist items and outstanding gaps', () => {
      const state = {
        coverageChecklist: [
          { requirement_id: 'r1', status: 'verified' },
          { requirement_id: 'r2', status: 'pending' },
        ],
        finalMarkdown: 'Only mentions Dijkstra.',
        outstandingGaps: [{ requirement_id: 'r2', description: 'Omitted Bellman-Ford' }],
      };

      const score = calculateCompletenessScore(state, ['Dijkstra', 'Bellman-Ford']);
      expect(score).toBeLessThan(0.7);
    });
  });

  describe('calculateFaithfulnessScore', () => {
    it('returns 1.0 when all verification results pass with no grounding issues', () => {
      const state = {
        verificationResults: [
          { section_id: 's1', passed: true, checks: { grounding: 'pass' }, issues: [] },
          { section_id: 's2', passed: true, checks: { grounding: 'pass' }, issues: [] },
        ],
      };

      const score = calculateFaithfulnessScore(state);
      expect(score).toBe(1.0);
    });

    it('penalizes grounding failures and issues', () => {
      const state = {
        verificationResults: [
          { section_id: 's1', passed: true, checks: { grounding: 'pass' }, issues: [] },
          {
            section_id: 's2',
            passed: false,
            checks: { grounding: 'fail' },
            issues: [{ check: 'grounding', severity: 'high', description: 'Ungrounded claim' }],
          },
        ],
      };

      const score = calculateFaithfulnessScore(state);
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('calculateCoherenceScore', () => {
    it('returns 1.0 when term definitions are consistent and anchors resolve', () => {
      const state = {
        termsDefined: [
          { term: 'Entropy', definition: 'A measure of microscopic disorder in a thermodynamic system.' },
          { term: 'Enthalpy', definition: 'Total heat content of a system.' },
        ],
        crossReferenceAnchors: [
          { anchor_id: 'sec-entropy', label: 'Entropy' },
        ],
        finalMarkdown: 'Here we discuss Entropy (see #sec-entropy) and Enthalpy.',
      };

      const score = calculateCoherenceScore(state);
      expect(score).toBe(1.0);
    });

    it('penalizes contradictory term definitions', () => {
      const state = {
        termsDefined: [
          { term: 'Entropy', definition: 'Def A' },
          { term: 'Entropy', definition: 'Contradictory Def B' },
        ],
        crossReferenceAnchors: [],
        finalMarkdown: 'Some text',
      };

      const score = calculateCoherenceScore(state);
      expect(score).toBeLessThan(1.0);
    });
  });

  describe('calculateSingleScore & calculateAggregateScore', () => {
    it('calculates composite score Q_i using weighted formula (35/25/20/20)', () => {
      const score = calculateSingleScore({
        completeness: 1.0,  // 35%
        faithfulness: 1.0,  // 25%
        coherence: 1.0,     // 20%
        syntax: 1.0,        // 20%
      });

      expect(score).toBe(100.0);

      const partialScore = calculateSingleScore({
        completeness: 0.90, // 31.5
        faithfulness: 0.90, // 22.5
        coherence: 0.95,    // 19.0
        syntax: 1.00,       // 20.0
      });

      expect(partialScore).toBe(93.0);
    });

    it('calculates aggregate mean score across multiple benchmark runs', () => {
      const scores = [96.0, 98.0, 94.0, 96.0];
      expect(calculateAggregateScore(scores)).toBe(96.0);
    });
  });
});
