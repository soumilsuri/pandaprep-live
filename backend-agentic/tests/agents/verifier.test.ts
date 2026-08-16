import { describe, it, expect } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import {
  verifySection,
  checkLatexSyntax,
  checkAnchorReferences,
} from '../../src/agents/verifier.agent.js';

setLLMResponse('Automated Verifier Agent', {
  passed: true,
  checks: {
    coverage: 'pass',
    missing_topics: 'pass',
    terminology: 'pass',
    grounding: 'pass',
  },
  issues: [],
});

describe('Verifier Agent & Contract Checks', () => {
  it('should detect unclosed LaTeX syntax deterministically', () => {
    const invalidDisplayMath = 'Equation: $$ \\mathcal{O}(n) ';
    const displayResult = checkLatexSyntax(invalidDisplayMath);
    expect(displayResult.valid).toBe(false);
    expect(displayResult.issue).toContain('display');

    const invalidInlineMath = 'Let $x be a variable';
    const inlineResult = checkLatexSyntax(invalidInlineMath);
    expect(inlineResult.valid).toBe(false);
    expect(inlineResult.issue).toContain('inline');

    const validMath = 'Inline $x = 5$ and display $$\\sum_{i=1}^n i$$';
    const validResult = checkLatexSyntax(validMath);
    expect(validResult.valid).toBe(true);

    const validMathWithCode = 'Here is code ```bash\necho $VARIABLE\n``` and inline `$x = 5$`.';
    const codeResult = checkLatexSyntax(validMathWithCode);
    expect(codeResult.valid).toBe(true);
  });

  it('should detect broken cross-reference anchors deterministically', () => {
    const markdownWithBrokenLink = 'See [BST Rotation](#sec-99-nonexistent) for details.';
    const availableAnchors = [
      { anchor_id: 'sec-01-bst', section_id: 'sec_01', label: 'BST Property' },
    ];

    const result = checkAnchorReferences(markdownWithBrokenLink, availableAnchors, 'sec_02');
    expect(result.valid).toBe(false);
    expect(result.brokenAnchors).toContain('sec-99-nonexistent');
  });

  it('should execute full verification contract checks on a valid section', async () => {
    const result = await verifySection({
      subject_name: 'Data Structures',
      section_id: 'sec_01',
      section: {
        title: 'Binary Search Trees',
        content_markdown: `## Binary Search Trees

A Binary Search Tree (BST) is a node-based binary tree data structure which has the following properties:
- The left subtree of a node contains only nodes with keys lesser than the node's key.
- The right subtree of a node contains only nodes with keys greater than the node's key.

$$\\text{Search Complexity: } \\mathcal{O}(\\log n)$$

Insertion and deletion operations also run in $\\mathcal{O}(h)$ time where $h$ is the height of the tree.`,
        status: 'completed',
      },
      mapped_checklist_items: [
        {
          requirement_id: 'req_01',
          syllabus_text: 'Binary Search Trees: Insertion, Deletion, Search',
          mapped_section_id: 'sec_01',
          status: 'drafted',
        },
      ],
      terms_defined: [],
      available_anchors: [],
      iteration: 1,
    });

    expect(result).toBeDefined();
    expect(result.section_id).toBe('sec_01');
    expect(result.checks.latex_syntax).toBe('pass');
    expect(result.checks.cross_reference).toBe('pass');
    expect(result.passed).toBe(true);
  });
});
