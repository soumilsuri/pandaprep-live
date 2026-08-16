import { getFastLLM } from './llm.js';
import { IStyleDecisions } from '../models/notes-workspace.model.js';
import { logger } from '../config/logger.js';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export interface IntakeInput {
  education_level?: 'beginner' | 'intermediate' | 'advanced';
  note_type?: 'concise' | 'detailed' | 'qa';
  user_instructions?: string;
  include_examples?: 'yes' | 'no';
}

const MAX_USER_INSTRUCTIONS_CHARS = 4000;

function truncateInput(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, maxChars)}\n\n[... input truncated for length ...]`;
}

export async function runIntakeAgent(input: IntakeInput): Promise<IStyleDecisions> {
  const fallbackDefaults: IStyleDecisions = {
    depth: input.note_type || 'detailed',
    tone: 'academic_rigorous',
    math_format: 'latex_mathjax',
    include_code_examples: input.include_examples === 'yes',
    primary_language: 'English',
  };

  if (!input.user_instructions || input.user_instructions.trim().length === 0) {
    return fallbackDefaults;
  }

  try {
    const llm = getFastLLM();
    const userInstructions = truncateInput(input.user_instructions, MAX_USER_INSTRUCTIONS_CHARS);

    const systemPrompt = `You are the PandaPrep Intake Resolution Agent.
Your job is to interpret the user's free-text study preferences and instructions to configure concrete style parameters for note generation.

Output JSON schema:
{
  "depth": "concise" | "detailed" | "qa",
  "tone": "academic_rigorous" | "intuitive_simplified" | "exam_cram",
  "math_format": "latex_mathjax",
  "include_code_examples": boolean,
  "primary_language": string,
  "focus_areas": string[],
  "special_instructions": string
}

Return ONLY valid JSON. No markdown backticks, no markdown fence, no preamble.`;

    const userPrompt = `User Education Level: ${input.education_level || 'intermediate'}
Requested Note Type: ${input.note_type || 'detailed'}
Include Examples: ${input.include_examples || 'no'}
User Instructions: ${userInstructions}`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      ...fallbackDefaults,
      ...parsed,
    };
  } catch (error) {
    logger.warn({ err: error }, 'Intake Agent failed to parse structured output; falling back to defaults');
    return fallbackDefaults;
  }
}
