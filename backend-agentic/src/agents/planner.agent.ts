import { getCapableLLM } from './llm.js';
import { parseLLMJson } from './parse.js';
import {
  ITopicGraph,
  ITopicGraphNode,
  ICoverageChecklistItem,
  IStyleDecisions,
} from '../models/notes-workspace.model.js';
import { logger } from '../config/logger.js';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

export interface PlannerInput {
  subject_name: string;
  syllabus: string;
  note_type?: 'concise' | 'detailed' | 'qa';
  education_level?: 'beginner' | 'intermediate' | 'advanced';
  user_instructions?: string;
  style_decisions?: IStyleDecisions;
}

export interface PlannerOutput {
  topic_graph: ITopicGraph;
  coverage_checklist: ICoverageChecklistItem[];
  style_decisions: IStyleDecisions;
  syllabus_topics: string[];
}

const MAX_SYLLABUS_CHARS = 20000;
const MAX_USER_INSTRUCTIONS_CHARS = 4000;

function truncateInput(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, maxChars)}\n\n[... input truncated for length ...]`;
}

const plannerOutputSchema = z.object({
  topic_graph: z.object({
    nodes: z.array(
      z.object({
        section_id: z.string(),
        title: z.string(),
        estimated_words: z.number().optional().default(500),
        key_concepts: z.array(z.string()),
      })
    ),
    edges: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        relationship: z.string().optional().default('prerequisite'),
      })
    ),
  }),
  coverage_checklist: z.array(
    z.object({
      requirement_id: z.string(),
      syllabus_text: z.string(),
      mapped_section_id: z.string(),
      status: z.enum(['pending', 'drafted', 'verified']).default('pending'),
    })
  ),
  style_decisions: z.record(z.unknown()).optional(),
});

/**
 * Deterministic fallback topic graph builder if LLM response fails validation.
 */
function buildDeterministicPlan(input: PlannerInput, syllabusLines: string[]): PlannerOutput {
  const nodes = syllabusLines.map((line, idx) => ({
    section_id: `sec_${String(idx + 1).padStart(2, '0')}`,
    title: line.replace(/^(Unit|Chapter|Module|Topic)\s*\d*[:.-]?\s*/i, '').trim() || `Topic ${idx + 1}`,
    estimated_words: 500,
    key_concepts: [line],
  }));

  const edges = nodes.slice(0, -1).map((curr, idx) => ({
    from: curr.section_id,
    to: nodes[idx + 1].section_id,
    relationship: 'prerequisite',
  }));

  const checklist = nodes.map((node, idx) => ({
    requirement_id: `req_${String(idx + 1).padStart(2, '0')}`,
    syllabus_text: syllabusLines[idx],
    mapped_section_id: node.section_id,
    status: 'pending' as const,
  }));

  return {
    topic_graph: { nodes, edges },
    coverage_checklist: checklist,
    style_decisions: {
      depth: input.note_type || 'detailed',
      tone: 'academic_rigorous',
      math_format: 'latex_mathjax',
      include_code_examples: true,
      primary_language: 'English',
      ...input.style_decisions,
    },
    syllabus_topics: syllabusLines,
  };
}

/**
 * Sanitizes a validated plan for referential integrity (WR-020):
 * drops duplicate node ids, edges referencing missing nodes, self-loops,
 * and checklist items mapped to missing sections. Never throws.
 */
function sanitizePlan(plan: PlannerOutput): PlannerOutput {
  const seenIds = new Set<string>();
  const nodes: ITopicGraphNode[] = [];
  for (const node of plan.topic_graph.nodes) {
    if (seenIds.has(node.section_id)) {
      logger.warn({ sectionId: node.section_id }, 'Planner dropped duplicate node id from topic graph');
      continue;
    }
    seenIds.add(node.section_id);
    nodes.push(node);
  }

  const nodeIds = new Set(nodes.map((n) => n.section_id));

  const edges = plan.topic_graph.edges.filter((edge) => {
    if (edge.from === edge.to) {
      logger.warn({ from: edge.from }, 'Planner dropped self-loop edge from topic graph');
      return false;
    }
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      logger.warn(
        { from: edge.from, to: edge.to },
        'Planner dropped edge referencing missing node'
      );
      return false;
    }
    return true;
  });

  const coverageChecklist = plan.coverage_checklist.filter((item) => {
    if (!nodeIds.has(item.mapped_section_id)) {
      logger.warn(
        { requirementId: item.requirement_id, mappedSectionId: item.mapped_section_id },
        'Planner dropped checklist item mapped to missing section'
      );
      return false;
    }
    return true;
  });

  return {
    ...plan,
    topic_graph: { ...plan.topic_graph, nodes, edges },
    coverage_checklist: coverageChecklist,
  };
}

export async function runPlannerAgent(input: PlannerInput): Promise<PlannerOutput> {
  const syllabus = truncateInput(input.syllabus, MAX_SYLLABUS_CHARS);
  const userInstructions = truncateInput(
    input.user_instructions || 'None',
    MAX_USER_INSTRUCTIONS_CHARS
  );
  const syllabusLines = syllabus
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const fallback = buildDeterministicPlan(input, syllabusLines);

  try {
    const llm = getCapableLLM();

    const systemPrompt = `You are the PandaPrep Lead Syllabus Planner.
Your job is to analyze the syllabus and produce a structured revision note plan:
1. Break down the syllabus into sequential sections.
2. Identify prerequisite relationships between sections (edges in a DAG).
3. Create a strict coverage checklist where EVERY syllabus item is assigned to a section.
4. Establish tone and depth rules in style_decisions.

Output JSON schema:
{
  "topic_graph": {
    "nodes": [
      {
        "section_id": "sec_01",
        "title": "Section Title",
        "estimated_words": 500,
        "key_concepts": ["concept1", "concept2"]
      }
    ],
    "edges": [
      { "from": "sec_01", "to": "sec_02", "relationship": "prerequisite" }
    ]
  },
  "coverage_checklist": [
    {
      "requirement_id": "req_01",
      "syllabus_text": "Exact syllabus requirement text",
      "mapped_section_id": "sec_01",
      "status": "pending"
    }
  ],
  "style_decisions": {
    "depth": "detailed",
    "tone": "academic_rigorous",
    "include_code_examples": true
  }
}

Return ONLY valid JSON. No markdown code blocks, no backticks, no explanations.`;

    const userPrompt = `Subject: ${input.subject_name}
Note Type: ${input.note_type || 'detailed'}
Education Level: ${input.education_level || 'intermediate'}
User Instructions: ${userInstructions}
Syllabus:
${syllabus}`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parsed = parseLLMJson(content, plannerOutputSchema);

    if (!parsed.ok) {
      throw parsed.error;
    }

    const validated = parsed.data;

    const plan: PlannerOutput = {
      topic_graph: validated.topic_graph,
      coverage_checklist: validated.coverage_checklist,
      style_decisions: {
        ...fallback.style_decisions,
        ...validated.style_decisions,
      },
      syllabus_topics: syllabusLines,
    };

    return sanitizePlan(plan);
  } catch (error) {
    logger.warn({ err: error }, 'Planner Agent structured parsing encountered error; falling back to deterministic plan');
    return fallback;
  }
}
