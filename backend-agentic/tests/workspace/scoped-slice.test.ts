import { describe, it, expect } from 'vitest';
import { getScopedWorkspaceSlice } from '../../src/workspace/scoped-slice.js';

describe('Scoped Workspace Slice Helper', () => {
  const mockWorkspace = {
    topicGraph: {
      nodes: [
        {
          section_id: 'sec_01',
          title: 'Binary Search Trees',
          key_concepts: ['BST property', 'search', 'insert'],
        },
        {
          section_id: 'sec_02',
          title: 'AVL Trees',
          key_concepts: ['balance factor', 'rotations'],
        },
        {
          section_id: 'sec_03',
          title: 'B-Trees',
          key_concepts: ['multi-way search', 'disk storage'],
        },
      ],
      edges: [
        { from: 'sec_01', to: 'sec_02', relationship: 'prerequisite' },
      ],
    },
    styleDecisions: {
      depth: 'detailed' as const,
      tone: 'academic_rigorous',
    },
    termsDefined: [
      {
        term: 'BST Property',
        definition: 'Left < Root < Right',
        introduced_in_section: 'sec_01',
      },
      {
        term: 'B-Tree Order',
        definition: 'Max children per node',
        introduced_in_section: 'sec_03',
      },
    ],
    crossReferenceAnchors: [
      {
        anchor_id: 'sec-01-bst',
        section_id: 'sec_01',
        label: 'BST Invariant',
      },
    ],
  };

  it('should include prerequisite terms and anchors for dependent section', () => {
    const slice = getScopedWorkspaceSlice(mockWorkspace, 'sec_02');

    expect(slice).toBeDefined();
    expect(slice?.section_info.section_id).toBe('sec_02');
    expect(slice?.section_info.title).toBe('AVL Trees');
    expect(slice?.prerequisite_terms.length).toBe(1);
    expect(slice?.prerequisite_terms[0].term).toBe('BST Property');
    expect(slice?.available_anchors.length).toBe(1);
    expect(slice?.available_anchors[0].anchor_id).toBe('sec-01-bst');
  });

  it('should have empty prerequisites for root/independent section', () => {
    const slice = getScopedWorkspaceSlice(mockWorkspace, 'sec_01');

    expect(slice).toBeDefined();
    expect(slice?.prerequisite_terms.length).toBe(0);
    expect(slice?.available_anchors.length).toBe(0);
  });
});
