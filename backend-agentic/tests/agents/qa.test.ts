import { describe, it, expect } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { runQAAgent } from '../../src/agents/qa.agent.js';

setLLMResponse('balance factor condition in an AVL tree', {
  reply:
    'The balance factor of a node in an AVL tree is defined as the height of its left subtree minus the height of its right subtree: $$\\text{BF}(v) = \\text{height}(v.\\text{left}) - \\text{height}(v.\\text{right})$$. For the tree to remain balanced, every node must satisfy $\\text{BF}(v) \\in \\{-1, 0, 1\\}$. When an insertion or deletion violates this invariant, rotations are applied to restore the balance.',
  sources: ['AVL Trees'],
  suggested_followups: [
    'Quiz me on AVL tree rotations',
    'Explain LL and RR rotations',
    'How do I compute the height of a subtree?',
  ],
});

setLLMResponse('Quiz me on AVL tree rotations', {
  reply:
    '**Quiz Question 1:** What is the balance factor condition that every AVL node must satisfy?\n\nAnswer: $\\text{BF}(v) \\in \\{-1, 0, 1\\}$.\n\n**Quiz Question 2:** Which rotations are used to rebalance an AVL tree after an insertion? Explain when LR and RL double rotations are applied.\n\n**Quiz Question 3:** What is the worst-case time complexity of search in a skewed BST compared to an AVL tree?',
  sources: ['AVL Trees'],
  suggested_followups: ['Explain double rotations', 'Give me a practice problem on balancing'],
});

describe('Interactive Q&A Agent', () => {
  const sampleNotes = `# Data Structures Revision Notes

## Table of Contents
1. [Binary Search Trees](#sec_01)
2. [AVL Trees](#sec_02)

---

<a id="sec_01"></a>

## Binary Search Trees

A Binary Search Tree (BST) is a hierarchical data structure where each node satisfies the BST invariant:
$$\\text{Left Subtree Keys} < \\text{Root Key} < \\text{Right Subtree Keys}$$

Search, insertion, and deletion run in $\\mathcal{O}(h)$ time where $h$ is height. In the worst case (skewed tree), $h = n$, resulting in $\\mathcal{O}(n)$ complexity.

---

<a id="sec_02"></a>

## AVL Trees

An AVL tree is a strictly height-balanced BST where for every node, the balance factor is defined as:
$$\\text{BF}(v) = \\text{height}(v.\\text{left}) - \\text{height}(v.\\text{right}) \\in \\{-1, 0, 1\\}$$

Rotations used for rebalancing:
1. Single Left (LL)
2. Single Right (RR)
3. Double Left-Right (LR)
4. Double Right-Left (RL)
`;

  it('should answer questions grounded in the student revision notes', async () => {
    const output = await runQAAgent({
      subject_name: 'Data Structures',
      notes_markdown: sampleNotes,
      user_message: 'What is the balance factor condition in an AVL tree?',
      workspace_terms: [
        { term: 'Balance Factor', definition: 'Height of left subtree minus height of right subtree' },
      ],
    });

    expect(output).toBeDefined();
    expect(output.reply).toBeDefined();
    expect(output.reply.length).toBeGreaterThan(20);
    expect(output.suggested_followups).toBeDefined();
    expect(output.suggested_followups.length).toBeGreaterThan(0);
  });

  it('should generate active recall quiz questions when prompted', async () => {
    const output = await runQAAgent({
      subject_name: 'Data Structures',
      notes_markdown: sampleNotes,
      user_message: 'Quiz me on AVL tree rotations and BST worst-case time complexity.',
    });

    expect(output).toBeDefined();
    expect(output.reply).toBeDefined();
    expect(output.reply.toLowerCase()).toMatch(/(question|quiz|rotation|complexity|\$)/);
  });
});
