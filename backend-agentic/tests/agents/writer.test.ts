import { describe, it, expect } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { draftSection } from '../../src/agents/writer.agent.js';

setLLMResponse('Section Writer', {
  content_markdown:
    '## Binary Search Trees\n\nA Binary Search Tree (BST) is a node-based binary tree where each node satisfies the BST invariant: left subtree keys are smaller and right subtree keys are larger than the node key.\n\n- Search, insertion, and deletion run in $O(h)$ time where $h$ is the height of the tree.\n- In the worst case a skewed tree gives $h = n$ and $O(n)$ complexity.\n\n$$\\text{Search Complexity: } O(\\log n)$$\n\n### Operations\n\n1. **Search**: compare the target key with the root and recurse into the matching subtree.\n2. **Insert**: navigate to the correct leaf position following the BST invariant.\n3. **Delete**: handle leaf, single-child, and two-child cases using the in-order successor.',
  new_terms_defined: [
    {
      term: 'BST Property',
      definition: 'Left subtree keys are less than the root key; right subtree keys are greater.',
    },
    {
      term: 'In-order Traversal',
      definition: 'Visits nodes in ascending key order: left, root, right.',
    },
  ],
  new_anchors: [{ anchor_id: 'sec-01-bst-property', label: 'BST Property' }],
});

describe('Writer Agent', () => {
  it('should draft section markdown with LaTeX math and extracted terms/anchors', async () => {
    const result = await draftSection({
      subject_name: 'Data Structures',
      scoped_slice: {
        section_info: {
          section_id: 'sec_01',
          title: 'Binary Search Trees',
          estimated_words: 400,
          key_concepts: ['BST property', 'In-order traversal', 'Search operations'],
        },
        style_rules: {
          depth: 'detailed',
          tone: 'academic_rigorous',
          math_format: 'latex_mathjax',
        },
        prerequisite_terms: [],
        available_anchors: [],
        prerequisite_section_titles: [],
      },
    });

    expect(result).toBeDefined();
    expect(result.section_id).toBe('sec_01');
    expect(result.section.title).toBe('Binary Search Trees');
    expect(result.section.content_markdown).toBeDefined();
    expect(result.section.content_markdown.length).toBeGreaterThan(50);
    expect(result.section.status).toBe('completed');
  });
});
