import { describe, it, expect } from 'vitest';
import { mergeCheckpointIntoInitialState } from '../../src/queue/worker.js';

const initial = {
  missionId: 'req-1',
  userId: 'user-1',
  email: 'student@example.com',
  subjectName: 'Algorithms',
  syllabus: 'Unit 1: Sorting',
  userInstructions: 'Be rigorous',
  noteType: 'detailed',
  educationLevel: 'intermediate',
  includeExamples: 'no',
  format: 'markdown',
};

describe('Worker checkpoint resume merge (WR-009)', () => {
  it('checkpoint working-memory keys win over freshly built initial state', () => {
    const checkpoint = {
      syllabusTopics: ['Sorting'],
      topicGraph: {
        nodes: [{ section_id: 'sec_01', title: 'Sorting', key_concepts: ['Quicksort'] }],
        edges: [],
      },
      coverageChecklist: [
        {
          requirement_id: 'req_01',
          syllabus_text: 'Unit 1: Sorting',
          mapped_section_id: 'sec_01',
          status: 'verified',
        },
      ],
      generatedSections: {
        sec_01: { title: 'Sorting', content_markdown: '# Sorting', status: 'completed' },
      },
      termsDefined: [{ term: 'Quicksort', definition: 'Divide and conquer sort', introduced_in_section: 'sec_01' }],
      crossReferenceAnchors: [{ anchor_id: 'a-1', section_id: 'sec_01', label: 'Sorting' }],
      styleDecisions: { depth: 'detailed', tone: 'academic_rigorous' },
      sourcesUsed: { sec_01: [{ type: 'web_search', query: 'sorting' }] },
      verificationResults: [
        { section_id: 'sec_01', iteration: 1, passed: true, checks: { coverage: 'pass' }, issues: [] },
      ],
      repairIterations: { sec_01: 1 },
      documentRepairPasses: 2,
      outstandingGaps: [{ section_id: 'sec_01', description: 'gap', severity: 'low' }],
      finalMarkdown: '# Completed notes',
    };

    const merged = mergeCheckpointIntoInitialState(initial, checkpoint);

    expect(merged.syllabusTopics).toEqual(['Sorting']);
    expect(merged.topicGraph).toEqual(checkpoint.topicGraph);
    expect(merged.coverageChecklist).toEqual(checkpoint.coverageChecklist);
    expect(merged.generatedSections).toEqual(checkpoint.generatedSections);
    expect(merged.termsDefined).toEqual(checkpoint.termsDefined);
    expect(merged.crossReferenceAnchors).toEqual(checkpoint.crossReferenceAnchors);
    expect(merged.styleDecisions).toEqual(checkpoint.styleDecisions);
    expect(merged.sourcesUsed).toEqual(checkpoint.sourcesUsed);
    expect(merged.verificationResults).toEqual(checkpoint.verificationResults);
    expect(merged.repairIterations).toEqual(checkpoint.repairIterations);
    expect(merged.documentRepairPasses).toBe(2);
    expect(merged.outstandingGaps).toEqual(checkpoint.outstandingGaps);
    expect(merged.finalMarkdown).toBe('# Completed notes');

    expect(merged.missionId).toBe('req-1');
    expect(merged.email).toBe('student@example.com');
    expect(merged.syllabus).toBe('Unit 1: Sorting');
    expect(merged.noteType).toBe('detailed');
  });

  it('ignores checkpoint keys that are absent, null, or shape-invalid', () => {
    const merged = mergeCheckpointIntoInitialState(initial, {
      syllabusTopics: 'not-an-array',
      topicGraph: [1, 2, 3],
      generatedSections: null,
      termsDefined: {},
      crossReferenceAnchors: 'nope',
      styleDecisions: { depth: 'concise' },
      sourcesUsed: [],
      verificationResults: 42,
      repairIterations: null,
      documentRepairPasses: 'three',
      outstandingGaps: 'gap',
      finalMarkdown: 42,
      unknownFutureKey: { anything: true },
    });

    expect(merged.syllabusTopics).toBeUndefined();
    expect(merged.topicGraph).toBeUndefined();
    expect(merged.generatedSections).toBeUndefined();
    expect(merged.termsDefined).toBeUndefined();
    expect(merged.crossReferenceAnchors).toBeUndefined();
    expect(merged.styleDecisions).toEqual({ depth: 'concise' });
    expect(merged.sourcesUsed).toBeUndefined();
    expect(merged.verificationResults).toBeUndefined();
    expect(merged.repairIterations).toBeUndefined();
    expect(merged.documentRepairPasses).toBeUndefined();
    expect(merged.outstandingGaps).toBeUndefined();
    expect(merged.finalMarkdown).toBeUndefined();

    expect((merged as Record<string, unknown>).unknownFutureKey).toBeUndefined();

    expect(merged.missionId).toBe('req-1');
    expect(merged.syllabus).toBe('Unit 1: Sorting');
  });

  it('returns initial state unchanged for an empty checkpoint', () => {
    const merged = mergeCheckpointIntoInitialState(initial, {});
    expect(merged).toEqual(initial);
  });
});