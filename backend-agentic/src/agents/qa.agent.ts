import { getCapableLLM } from './llm.js';
import { parseLLMJson, MAX_NOTES_CONTEXT_CHARS } from './parse.js';
import { logger } from '../config/logger.js';
import { z } from 'zod';

export interface QAMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface QAAgentInput {
  subject_name: string;
  notes_markdown: string;
  user_message: string;
  chat_history?: QAMessage[];
  workspace_terms?: Array<{ term: string; definition: string }>;
}

export interface QAAgentOutput {
  reply: string;
  sources: string[];
  suggested_followups: string[];
}

const qaOutputSchema = z
  .object({
    reply: z.string().optional(),
    sources: z.unknown().optional(),
    suggested_followups: z.unknown().optional(),
  })
  .passthrough();

export async function runQAAgent(input: QAAgentInput): Promise<QAAgentOutput> {
  const {
    subject_name,
    notes_markdown,
    user_message,
    chat_history = [],
    workspace_terms = [],
  } = input;

  logger.info({ subject_name, messageLength: user_message.length }, 'Running Q&A Agent...');

  // Format chat history context (last 6 turns)
  const historyText = chat_history
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  // Format defined terms context
  const termsText = workspace_terms
    .slice(0, 20)
    .map((t) => `- **${t.term}**: ${t.definition}`)
    .join('\n');

  // Truncate notes if needed for context budget
  const truncatedNotes =
    notes_markdown.length > MAX_NOTES_CONTEXT_CHARS
      ? notes_markdown.slice(0, MAX_NOTES_CONTEXT_CHARS) + '\n\n[... Remaining notes truncated for length ...]'
      : notes_markdown;

  // Check if the user is asking for external/web search or quiz
  const isQuizRequest = /\b(quiz|quizzes|test me|practice question|mcq|mcqs|flashcard|flashcards)\b/i.test(user_message);
  const isExplainMore = /\b(explain more|analogy|deep dive|elaborate|simplify|intuition)\b/i.test(user_message);

  let extraContext = '';
  const sources: string[] = [];

  if (isQuizRequest) {
    extraContext += '\n[Instruction: User is requesting a self-test or quiz. Provide 2-3 focused active-recall questions followed by detailed explanations/answer keys.]';
  } else if (isExplainMore) {
    extraContext += '\n[Instruction: User is requesting an intuitive explanation. Provide concrete analogies, step-by-step walkthroughs, and clear mathematical formulas.]';
  }

  const prompt = `You are PandaPrep AI, a master academic tutor and exam preparation specialist.
You are helping a student revise and master **${subject_name}** based on their custom-generated revision notes.

### Defined Key Terms:
${termsText || 'Standard domain terminology.'}

### Student's Generated Revision Notes:
${truncatedNotes}

### Recent Conversation History:
${historyText || 'No prior conversation.'}

### User's Current Question:
${user_message}
${extraContext}

### Persona & Response Guidelines:
1. **Grounding & Accuracy**: Base your answer primarily on the student's revision notes and defined terms.
2. **Mathematical & Scientific Rigor**: Always write math expressions using valid LaTeX ($...$ inline, $$...$$ display).
3. **Citations**: Mention the specific sections from the notes you are referencing (e.g., "[Section: Binary Search Trees]").
4. **Pedagogical Clarity**: Provide intuitive explanations, structured bullet points, and code/pseudocode where helpful.
5. **Interactive Engagement**: Suggest 2-3 follow-up prompts or questions to help the student continue studying.

Return your response strictly in the following JSON format:
\`\`\`json
{
  "reply": "Your markdown formatted tutor response with LaTeX equations and citations",
  "sources": ["Section Title 1", "Section Title 2"],
  "suggested_followups": ["Quiz me on...", "Explain...", "How does this compare to..."]
}
\`\`\`
`;

  let content = '';

  try {
    const llm = getCapableLLM({ temperature: 0.3 });

    const response = await llm.invoke(prompt);
    content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    const parsed = parseLLMJson(content, qaOutputSchema);

    if (!parsed.ok) {
      throw parsed.error;
    }

    const sources = Array.isArray(parsed.data.sources) ? (parsed.data.sources as string[]) : [subject_name];
    const suggestedFollowups = Array.isArray(parsed.data.suggested_followups)
      ? (parsed.data.suggested_followups as string[])
      : [`Quiz me on ${subject_name}`, `Explain key concepts in ${subject_name}`];

    return {
      reply: parsed.data.reply || content,
      sources,
      suggested_followups: suggestedFollowups,
    };
  } catch (error) {
    logger.warn({ err: error }, 'Failed to parse structured Q&A response; returning raw LLM reply');
    return {
      reply: content || 'I was unable to generate a response at this time. Please try again.',
      sources: [subject_name],
      suggested_followups: [`Quiz me on ${subject_name}`, `Explain key concepts in ${subject_name}`],
    };
  }
}
