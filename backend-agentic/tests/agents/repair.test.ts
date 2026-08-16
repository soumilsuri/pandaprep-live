import { describe, it, expect } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { repairSection } from '../../src/agents/repair.agent.js';

setLLMResponse('Section Repair Specialist', {
  content_markdown:
    '## AVL Trees\n\nAVL trees are self-balancing binary search trees where every node stores a balance factor defined as:\n\n$$\\text{BF}(v) = \\text{height}(v.\\text{left}) - \\text{height}(v.\\text{right}) \\in \\{-1, 0, 1\\}$$\n\nThe balance factor must stay within $[-1, 1]$ after every operation, enforced through rotations:\n\n1. **LL (Left-Left)**: single right rotation.\n2. **RR (Right-Right)**: single left rotation.\n3. **LR (Left-Right)**: left rotation followed by a right rotation.\n4. **RL (Right-Left)**: right rotation followed by a left rotation.\n\nDouble rotations rebalance nodes where the inserted key lies in the inner subtree of an unbalanced grandparent, so both LR and RL cases are fully supported.',
  new_terms_defined: [],
  new_anchors: [],
});

describe('Repair Agent', () => {
  it('should patch section content based on verifier feedback', async () => {
    const existingSection = {
      title: 'AVL Trees',
      content_markdown: '## AVL Trees\n\nAVL trees are self-balancing BSTs. We only support LL and RR rotations.',
      status: 'completed' as const,
    };

    const issues = [
      {
        check: 'coverage',
        severity: 'high' as const,
        description: 'Missing explanation of double rotations (LR and RL).',
        repair_instruction: 'Add a subsection explaining LR (Left-Right) and RL (Right-Left) double rotations.',
      },
    ];

    const repaired = await repairSection({
      subject_name: 'Data Structures',
      scoped_slice: {
        section_info: {
          section_id: 'sec_02',
          title: 'AVL Trees',
          key_concepts: ['rotations', 'LR rotation', 'RL rotation'],
        },
        style_rules: {
          depth: 'detailed',
          tone: 'academic_rigorous',
        },
        prerequisite_terms: [],
        available_anchors: [],
        prerequisite_section_titles: [],
      },
      existing_section: existingSection,
      issues,
    });

    expect(repaired).toBeDefined();
    expect(repaired.section_id).toBe('sec_02');
    expect(repaired.section.content_markdown).toBeDefined();
    expect(repaired.section.content_markdown.length).toBeGreaterThanOrEqual(existingSection.content_markdown.length);
    expect(repaired.section.status).toBe('completed');
  });
});
