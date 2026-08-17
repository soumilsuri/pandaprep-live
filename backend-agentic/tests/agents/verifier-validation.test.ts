import { describe, it, expect, afterAll } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse, resetLLMResponses } from '../mocks/fake-llm.js';
import {
  verifySection,
  checkLatexSyntax,
  checkAnchorReferences,
} from '../../src/agents/verifier.agent.js';

setLLMResponse('Critical Severity Section', {
  passed: true,
  checks: { coverage: 'pass', missing_topics: 'pass', terminology: 'pass', grounding: 'pass' },
  issues: [{ check: 'coverage', severity: 'critical', description: 'Critical coverage gap.' }],
});

setLLMResponse('Severe Severity Section', {
  passed: true,
  checks: { coverage: 'pass', missing_topics: 'pass', terminology: 'pass', grounding: 'pass' },
  issues: [{ check: 'grounding', severity: 'severe', description: 'Severe factual issue.' }],
});

setLLMResponse('Missing Severity Section', {
  passed: true,
  checks: { coverage: 'pass', missing_topics: 'pass', terminology: 'pass', grounding: 'pass' },
  issues: [{ check: 'terminology', description: 'Terminology drift detected.' }],
});

setLLMResponse('Low Severity Only Section', {
  passed: true,
  checks: { coverage: 'pass', missing_topics: 'pass', terminology: 'pass', grounding: 'pass' },
  issues: [{ check: 'coverage', severity: 'low', description: 'Minor nitpick.' }],
});

setLLMResponse('Deterministic Cross-Reference Section', {
  passed: true,
  checks: { coverage: 'pass', missing_topics: 'pass', terminology: 'pass', grounding: 'pass' },
  issues: [],
});

function baseSection(title: string, content_markdown: string) {
  return { title, content_markdown, status: 'completed' as const };
}

describe('Verifier LLM issue normalization and integrity', () => {
  afterAll(() => {
    resetLLMResponses();
  });

  it('normalizes severity "critical" to high and fails the section even when checks pass', async () => {
    const result = await verifySection({
      subject_name: 'Data Structures',
      section_id: 'sec_01',
      section: baseSection('Critical Severity Section', '## Critical Severity Section\n\nSolid content.'),
      mapped_checklist_items: [],
      terms_defined: [],
      available_anchors: [],
      iteration: 1,
    });

    expect(result.checks.coverage).toBe('pass');
    expect(result.issues.some((i) => i.check === 'coverage' && i.severity === 'high')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('normalizes severity "severe" to high and fails the section', async () => {
    const result = await verifySection({
      subject_name: 'Data Structures',
      section_id: 'sec_01',
      section: baseSection('Severe Severity Section', '## Severe Severity Section\n\nSolid content.'),
      mapped_checklist_items: [],
      terms_defined: [],
      available_anchors: [],
      iteration: 1,
    });

    expect(result.issues.some((i) => i.severity === 'high')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('normalizes a missing severity to medium and fails the section', async () => {
    const result = await verifySection({
      subject_name: 'Data Structures',
      section_id: 'sec_01',
      section: baseSection('Missing Severity Section', '## Missing Severity Section\n\nSolid content.'),
      mapped_checklist_items: [],
      terms_defined: [],
      available_anchors: [],
      iteration: 1,
    });

    expect(result.issues.some((i) => i.severity === 'medium')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('passes when all checks pass and only a low-severity issue remains', async () => {
    const result = await verifySection({
      subject_name: 'Data Structures',
      section_id: 'sec_01',
      section: baseSection('Low Severity Only Section', '## Low Severity Only Section\n\nSolid content.'),
      mapped_checklist_items: [],
      terms_defined: [],
      available_anchors: [],
      iteration: 1,
    });

    expect(result.issues.some((i) => i.severity === 'low')).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('fails the section on a deterministic cross-reference failure with medium severity', async () => {
    const result = await verifySection({
      subject_name: 'Data Structures',
      section_id: 'sec_01',
      section: baseSection(
        'Deterministic Cross-Reference Section',
        '## Deterministic Cross-Reference Section\n\nSee [Missing Anchor](#sec-99-missing) for details.'
      ),
      mapped_checklist_items: [],
      terms_defined: [],
      available_anchors: [],
      iteration: 1,
    });

    expect(result.checks.cross_reference).toBe('fail');
    expect(result.issues.some((i) => i.check === 'cross_reference' && i.severity === 'medium')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('ignores $$ inside fenced code blocks when checking LaTeX syntax', () => {
    const markdown = [
      '```bash',
      'cost=$(echo $$((a + b)))',
      '```',
      '',
      '$$\\sum_{i=1}^n i$$ and inline $x = 5$',
    ].join('\n');

    const result = checkLatexSyntax(markdown);
    expect(result.valid).toBe(true);
  });

  it('rejects anchors that merely start with the current section id', () => {
    const result = checkAnchorReferences('[x](#sec_01-anchortext)', [], 'sec_01');

    expect(result.valid).toBe(false);
    expect(result.brokenAnchors).toContain('sec_01-anchortext');
  });
});