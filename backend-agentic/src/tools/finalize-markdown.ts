import {
  ITopicGraph,
  IGeneratedSection,
  IOutstandingGap,
  NotesWorkspaceModel,
} from '../models/notes-workspace.model.js';
import { NotesRequestModel } from '../models/notes-request.model.js';
import { logger } from '../config/logger.js';

export interface FinalizeMarkdownOptions {
  missionId: string;
  subjectName: string;
  topicGraph: ITopicGraph;
  generatedSections: Record<string, IGeneratedSection>;
  outstandingGaps?: IOutstandingGap[];
  processingTimeMs?: number;
}

export async function finalizeMarkdown(options: FinalizeMarkdownOptions): Promise<string> {
  const {
    missionId,
    subjectName,
    topicGraph,
    generatedSections,
    outstandingGaps = [],
    processingTimeMs,
  } = options;

  logger.info({ missionId, subjectName }, 'Assembling and persisting final Markdown revision notes...');

  // 1. Compile Table of Contents
  const tocLines = topicGraph.nodes.map(
    (node, i) => `${i + 1}. [${node.title}](#${node.section_id})`
  );
  const tocSection = `## Table of Contents\n\n${tocLines.join('\n')}`;

  // 2. Compile Body
  const bodySections = topicGraph.nodes.map((node) => {
    const sec = generatedSections[node.section_id];
    const content = sec?.content_markdown || `## ${node.title}\n\nContent generation completed.`;
    return `<a id="${node.section_id}"></a>\n\n${content}`;
  });

  // 3. Compile Outstanding Gaps (if any unresolvable items were logged)
  let gapsSection = '';
  if (outstandingGaps && outstandingGaps.length > 0) {
    gapsSection = `\n\n---\n\n## ⚠️ Note Regarding Syllabus Coverage\nThe following syllabus items were noted during automated contract checks:\n` +
      outstandingGaps.map((g) => `- **Section ${g.section_id || 'General'}**: ${g.description}`).join('\n');
  }

  const finalMarkdown = `# ${subjectName} Revision Notes\n\n${tocSection}\n\n---\n\n${bodySections.join('\n\n---\n\n')}${gapsSection}`;

  try {
    // 4. Update NotesWorkspaceModel (upsert so a missing workspace doc cannot silently drop the final markdown)
    const workspaceResult = await NotesWorkspaceModel.updateOne(
      { mission_id: missionId },
      {
        $set: {
          final_markdown: finalMarkdown,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    if (workspaceResult.matchedCount === 0 && workspaceResult.upsertedCount === 0) {
      throw new Error(
        `Workspace update for mission ${missionId} matched and upserted nothing; final markdown not persisted`
      );
    }

    // 5. Update NotesRequestModel with markdown content (upsert so a missing request cannot silently drop the final markdown)
    const requestResult = await NotesRequestModel.updateOne(
      { requestId: missionId },
      {
        $set: {
          markdown_content: finalMarkdown,
          status: 'completed',
          processing_time_ms: processingTimeMs,
        },
      },
      { upsert: true }
    );

    if (requestResult.matchedCount === 0 && requestResult.upsertedCount === 0) {
      throw new Error(
        `Request update for mission ${missionId} matched and upserted nothing; final markdown not persisted`
      );
    }

    logger.info({ missionId, byteSize: Buffer.byteLength(finalMarkdown, 'utf8') }, 'Final Markdown persisted to MongoDB');
  } catch (error) {
    logger.error({ err: error, missionId }, 'Failed to persist final markdown to MongoDB');
    throw error;
  }

  return finalMarkdown;
}
