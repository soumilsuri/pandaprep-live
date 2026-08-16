import { Annotation } from '@langchain/langgraph';
import {
  ITopicGraph,
  ICoverageChecklistItem,
  IGeneratedSection,
  ITermDefined,
  ICrossReferenceAnchor,
  IStyleDecisions,
  ISourceUsed,
  IVerificationResult,
  IOutstandingGap,
} from '../models/notes-workspace.model.js';

export const AgentStateAnnotation = Annotation.Root({
  missionId: Annotation<string>(),
  userId: Annotation<string | undefined>(),
  email: Annotation<string>(),
  subjectName: Annotation<string>(),
  syllabus: Annotation<string>(),
  userInstructions: Annotation<string | undefined>(),
  noteType: Annotation<'concise' | 'detailed' | 'qa'>(),
  educationLevel: Annotation<'beginner' | 'intermediate' | 'advanced'>(),
  includeExamples: Annotation<'yes' | 'no'>(),
  relativePathToReferenceMaterial: Annotation<string | undefined>(),
  format: Annotation<'markdown' | 'pdf'>(),

  // Working Memory Channels
  styleDecisions: Annotation<IStyleDecisions>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  syllabusTopics: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  topicGraph: Annotation<ITopicGraph>({
    reducer: (_, next) => next,
    default: () => ({ nodes: [], edges: [] }),
  }),
  coverageChecklist: Annotation<ICoverageChecklistItem[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  generatedSections: Annotation<Record<string, IGeneratedSection>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  termsDefined: Annotation<ITermDefined[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  crossReferenceAnchors: Annotation<ICrossReferenceAnchor[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  sourcesUsed: Annotation<Record<string, ISourceUsed[]>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  verificationResults: Annotation<IVerificationResult[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  repairIterations: Annotation<Record<string, number>>({
    reducer: (curr, next) => ({ ...curr, ...next }),
    default: () => ({}),
  }),
  documentRepairPasses: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  outstandingGaps: Annotation<IOutstandingGap[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  finalMarkdown: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  status: Annotation<'queued' | 'processing' | 'completed' | 'failed'>({
    reducer: (_, next) => next,
    default: () => 'processing',
  }),
  error: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
