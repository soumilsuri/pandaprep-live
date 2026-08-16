import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentStateAnnotation, AgentState } from './state.js';
import { mongoCheckpointer } from './checkpointer.js';
import { runIntakeAgent } from '../agents/intake.agent.js';
import { runPlannerAgent } from '../agents/planner.agent.js';
import { draftSection } from '../agents/writer.agent.js';
import { verifySection } from '../agents/verifier.agent.js';
import { repairSection } from '../agents/repair.agent.js';
import { getScopedWorkspaceSlice } from '../workspace/scoped-slice.js';
import { finalizeMarkdown } from '../tools/finalize-markdown.js';
import { notifyNotesReady } from '../tools/notify.js';
import {
  IVerificationResult,
  IOutstandingGap,
  IGeneratedSection,
  ISourceUsed,
} from '../models/notes-workspace.model.js';
import { logger } from '../config/logger.js';

const MAX_SECTION_REPAIRS = 2;

/**
 * Persists a checkpoint snapshot; save failures are logged and swallowed so
 * a checkpoint write can never fail a mission (WR-009).
 */
async function safeCheckpoint(missionId: string, node: string, state: Partial<AgentState>): Promise<void> {
  try {
    await mongoCheckpointer.saveCheckpoint(missionId, node, state);
  } catch (error) {
    logger.warn({ err: error, missionId, node }, 'Failed to save checkpoint; continuing without it');
  }
}

/**
 * Returns the latest verification result per section (highest iteration, last-wins on ties).
 * Avoids misattributing stale results when sections are skipped in later passes.
 */
function latestVerificationResults(state: AgentState): IVerificationResult[] {
  const latestBySection = new Map<string, IVerificationResult>();
  for (const result of state.verificationResults) {
    const existing = latestBySection.get(result.section_id);
    if (!existing || result.iteration >= existing.iteration) {
      latestBySection.set(result.section_id, result);
    }
  }
  return [...latestBySection.values()];
}

/**
 * 1. Intake Node: Interprets free-text user instructions into structured style decisions
 */
async function intakeNode(state: AgentState): Promise<Partial<AgentState>> {
  logger.info({ missionId: state.missionId }, '[Graph Node: Intake] Processing user preferences...');

  const styleDecisions = await runIntakeAgent({
    education_level: state.educationLevel,
    note_type: state.noteType,
    user_instructions: state.userInstructions,
    include_examples: state.includeExamples,
  });

  const update: Partial<AgentState> = {
    styleDecisions: {
      ...styleDecisions,
      ...state.styleDecisions,
    },
  };

  await safeCheckpoint(state.missionId, 'intake', { ...state, ...update });
  return update;
}

/**
 * 2. Planner Node: Parses syllabus and produces topic_graph + coverage_checklist
 */
async function plannerNode(state: AgentState): Promise<Partial<AgentState>> {
  logger.info({ missionId: state.missionId }, '[Graph Node: Planner] Decomposing syllabus topics...');

  const plan = await runPlannerAgent({
    subject_name: state.subjectName,
    syllabus: state.syllabus,
    note_type: state.noteType,
    education_level: state.educationLevel,
    user_instructions: state.userInstructions,
    style_decisions: state.styleDecisions,
  });

  const update: Partial<AgentState> = {
    syllabusTopics: plan.syllabus_topics,
    topicGraph: plan.topic_graph,
    coverageChecklist: plan.coverage_checklist,
    styleDecisions: {
      ...state.styleDecisions,
      ...plan.style_decisions,
    },
  };

  await safeCheckpoint(state.missionId, 'planner', { ...state, ...update });
  return update;
}

/**
 * 3. Writer Node: Drafts sections against the scoped workspace with concurrency bounds
 */
async function writerNode(state: AgentState): Promise<Partial<AgentState>> {
  logger.info(
    { missionId: state.missionId, sectionCount: state.topicGraph.nodes.length },
    '[Graph Node: Writer] Generating sections against scoped workspace...'
  );

  const generatedSections: Record<string, IGeneratedSection> = { ...state.generatedSections };
  let currentTerms = [...state.termsDefined];
  let currentAnchors = [...state.crossReferenceAnchors];
  const currentSources: Record<string, ISourceUsed[]> = { ...state.sourcesUsed };

  const completedSectionIds = new Set(
    Object.keys(generatedSections).filter((k) => generatedSections[k]?.status === 'completed')
  );

  const pendingNodes = state.topicGraph.nodes.filter((n) => !completedSectionIds.has(n.section_id));

  // Draft sections sequentially in topological DAG order to accumulate prerequisite terms & anchors
  for (const node of pendingNodes) {
    const scopedSlice = getScopedWorkspaceSlice(
      {
        topicGraph: state.topicGraph,
        styleDecisions: state.styleDecisions,
        termsDefined: currentTerms,
        crossReferenceAnchors: currentAnchors,
      },
      node.section_id
    );

    if (!scopedSlice) {
      logger.warn(
        { missionId: state.missionId, sectionId: node.section_id },
        'Section skipped: no scoped workspace slice available for drafting'
      );
      continue;
    }

    logger.info(
      { missionId: state.missionId, sectionId: node.section_id, title: node.title },
      'Drafting section...'
    );

    const draftResult = await draftSection({
      subject_name: state.subjectName,
      scoped_slice: scopedSlice,
    });

    generatedSections[node.section_id] = draftResult.section;
    currentTerms = [...currentTerms, ...draftResult.new_terms_defined];
    currentAnchors = [...currentAnchors, ...draftResult.new_anchors];
    currentSources[node.section_id] = draftResult.sources_used;
    completedSectionIds.add(node.section_id);
  }

  const updatedChecklist = state.coverageChecklist.map((item) => {
    if (completedSectionIds.has(item.mapped_section_id)) {
      return { ...item, status: 'drafted' as const };
    }
    return item;
  });

  const update: Partial<AgentState> = {
    generatedSections,
    termsDefined: currentTerms,
    crossReferenceAnchors: currentAnchors,
    sourcesUsed: currentSources,
    coverageChecklist: updatedChecklist,
  };

  await safeCheckpoint(state.missionId, 'writer', { ...state, ...update });
  return update;
}

/**
 * 4. Verifier Node: Automated contract checks against coverage checklist
 */
async function verifierNode(state: AgentState): Promise<Partial<AgentState>> {
  logger.info({ missionId: state.missionId }, '[Graph Node: Verifier] Executing contract checks...');

  const verificationResults: IVerificationResult[] = [];
  const currentRepairs = { ...state.repairIterations };
  const outstandingGaps: IOutstandingGap[] = [...state.outstandingGaps];

  for (const node of state.topicGraph.nodes) {
    const section = state.generatedSections[node.section_id];
    if (!section) {
      logger.warn(
        { missionId: state.missionId, sectionId: node.section_id },
        'Section skipped: no generated content available for verification'
      );
      continue;
    }

    const mappedChecklist = state.coverageChecklist.filter(
      (c) => c.mapped_section_id === node.section_id
    );

    const iteration = (currentRepairs[node.section_id] || 0) + 1;

    const result = await verifySection({
      subject_name: state.subjectName,
      section_id: node.section_id,
      section,
      mapped_checklist_items: mappedChecklist,
      terms_defined: state.termsDefined,
      available_anchors: state.crossReferenceAnchors,
      iteration,
    });

    verificationResults.push(result);

    if (!result.passed && (currentRepairs[node.section_id] || 0) >= MAX_SECTION_REPAIRS) {
      for (const issue of result.issues) {
        outstandingGaps.push({
          section_id: node.section_id,
          description: `[${issue.check}] ${issue.description}`,
          severity: issue.severity,
        });
      }
    }
  }

  const passedSectionIds = new Set(
    verificationResults.filter((r) => r.passed).map((r) => r.section_id)
  );

  const updatedChecklist = state.coverageChecklist.map((item) => {
    if (passedSectionIds.has(item.mapped_section_id)) {
      return { ...item, status: 'verified' as const };
    }
    return item;
  });

  const update: Partial<AgentState> = {
    verificationResults,
    coverageChecklist: updatedChecklist,
    outstandingGaps,
  };

  await safeCheckpoint(state.missionId, 'verifier', { ...state, ...update });
  return update;
}

/**
 * 5. Repair Node: Targeted repair pass for sections that failed contract checks
 */
async function repairNode(state: AgentState): Promise<Partial<AgentState>> {
  logger.info({ missionId: state.missionId }, '[Graph Node: Repair] Executing targeted section repairs...');

  const generatedSections: Record<string, IGeneratedSection> = { ...state.generatedSections };
  let currentTerms = [...state.termsDefined];
  let currentAnchors = [...state.crossReferenceAnchors];
  const repairIterations = { ...state.repairIterations };

  const latestResults = latestVerificationResults(state);
  const failedResults = latestResults.filter((r) => !r.passed);

  for (const failed of failedResults) {
    const sectionId = failed.section_id;
    const currentCount = repairIterations[sectionId] || 0;

    if (currentCount >= MAX_SECTION_REPAIRS) {
      continue;
    }

    const node = state.topicGraph.nodes.find((n) => n.section_id === sectionId);
    if (!node) continue;

    const scopedSlice = getScopedWorkspaceSlice(
      {
        topicGraph: state.topicGraph,
        styleDecisions: state.styleDecisions,
        termsDefined: currentTerms,
        crossReferenceAnchors: currentAnchors,
      },
      sectionId
    );

    if (!scopedSlice) continue;

    const repaired = await repairSection({
      subject_name: state.subjectName,
      scoped_slice: scopedSlice,
      existing_section: generatedSections[sectionId],
      issues: failed.issues,
    });

    generatedSections[sectionId] = repaired.section;
    currentTerms = [...currentTerms, ...repaired.new_terms_defined];
    currentAnchors = [...currentAnchors, ...repaired.new_anchors];
    repairIterations[sectionId] = currentCount + 1;
  }

  const update: Partial<AgentState> = {
    generatedSections,
    termsDefined: currentTerms,
    crossReferenceAnchors: currentAnchors,
    repairIterations,
  };

  await safeCheckpoint(state.missionId, 'repair', { ...state, ...update });
  return update;
}

/**
 * Routing Condition: Decides whether to route to repair or proceed to finalize.
 */
function routeAfterVerifier(state: AgentState): 'repair' | 'finalize' {
  const latestResults = latestVerificationResults(state);
  const failedResults = latestResults.filter((r) => !r.passed);

  if (failedResults.length === 0) {
    return 'finalize';
  }

  const canRepairAny = failedResults.some(
    (r) => (state.repairIterations[r.section_id] || 0) < MAX_SECTION_REPAIRS
  );

  if (canRepairAny) {
    return 'repair';
  }

  return 'finalize';
}

/**
 * 6. Finalize Node: Uses finalize_markdown and notify tools to complete mission
 */
async function finalizeNode(state: AgentState): Promise<Partial<AgentState>> {
  logger.info({ missionId: state.missionId }, '[Graph Node: Finalize] Finalizing Markdown and dispatching notification...');

  const finalMarkdown = await finalizeMarkdown({
    missionId: state.missionId,
    subjectName: state.subjectName,
    topicGraph: state.topicGraph,
    generatedSections: state.generatedSections,
    outstandingGaps: state.outstandingGaps,
  });

  // Dispatch transactional email notification (must never fail the mission)
  if (state.email) {
    try {
      await notifyNotesReady({
        recipientEmail: state.email,
        subjectName: state.subjectName,
        requestId: state.missionId,
      });
    } catch (error) {
      logger.warn({ err: error, missionId: state.missionId }, 'Failed to send notification email; continuing without it');
    }
  }

  const update: Partial<AgentState> = {
    finalMarkdown,
    status: 'completed',
  };

  await safeCheckpoint(state.missionId, 'finalize', { ...state, ...update });
  return update;
}

// Build the LangGraph StateGraph with tools and conditional repair loop
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode('intake', intakeNode)
  .addNode('planner', plannerNode)
  .addNode('writer', writerNode)
  .addNode('verifier', verifierNode)
  .addNode('repair', repairNode)
  .addNode('finalize', finalizeNode)
  .addEdge(START, 'intake')
  .addEdge('intake', 'planner')
  .addEdge('planner', 'writer')
  .addEdge('writer', 'verifier')
  .addConditionalEdges('verifier', routeAfterVerifier, {
    repair: 'repair',
    finalize: 'finalize',
  })
  .addEdge('repair', 'verifier')
  .addEdge('finalize', END);

export const notesGenerationGraph = workflow.compile();
