import {
  ITopicGraphNode,
  IStyleDecisions,
  ITermDefined,
  ICrossReferenceAnchor,
  INotesWorkspace,
} from '../models/notes-workspace.model.js';
import { AgentState } from '../graph/state.js';

export interface IScopedWorkspaceSlice {
  section_info: ITopicGraphNode;
  style_rules: IStyleDecisions;
  prerequisite_terms: ITermDefined[];
  available_anchors: ICrossReferenceAnchor[];
  prerequisite_section_titles: string[];
}

/**
 * Extracts a token-efficient scoped workspace slice for a given section.
 * This prevents prompt bloat by only passing relevant prerequisites,
 * defined terms, and available cross-reference anchors.
 */
export function getScopedWorkspaceSlice(
  workspace: {
    topicGraph: { nodes: ITopicGraphNode[]; edges: Array<{ from: string; to: string; relationship: string }> };
    styleDecisions: IStyleDecisions;
    termsDefined: ITermDefined[];
    crossReferenceAnchors: ICrossReferenceAnchor[];
  },
  targetSectionId: string
): IScopedWorkspaceSlice | null {
  const targetNode = workspace.topicGraph.nodes.find((n) => n.section_id === targetSectionId);
  if (!targetNode) return null;

  // 1. Identify prerequisite section IDs from DAG edges
  const prereqSectionIds = workspace.topicGraph.edges
    .filter((e) => e.to === targetSectionId)
    .map((e) => e.from);

  // 2. Identify titles of prerequisite sections
  const prereqTitles = workspace.topicGraph.nodes
    .filter((n) => prereqSectionIds.includes(n.section_id))
    .map((n) => n.title);

  // 3. Extract terms introduced in prerequisites
  const relevantTerms = workspace.termsDefined.filter((t) =>
    prereqSectionIds.includes(t.introduced_in_section)
  );

  // 4. Extract cross-reference anchors available from prerequisites
  const availableAnchors = workspace.crossReferenceAnchors.filter((a) =>
    prereqSectionIds.includes(a.section_id)
  );

  return {
    section_info: targetNode,
    style_rules: workspace.styleDecisions || {},
    prerequisite_terms: relevantTerms,
    available_anchors: availableAnchors,
    prerequisite_section_titles: prereqTitles,
  };
}
