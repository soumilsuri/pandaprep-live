import { ChatGroq } from '@langchain/groq';
import dotenv from "dotenv";

dotenv.config();

class SyllabusAnalyzerAgent {
  static getSystemPrompt(params) {
    const {
      subject_name,
      syllabus,
      note_type = 'detailed',
      include_examples = 'No',
      education_level = 'intermediate',
      user_instructions = '',
    } = params;

    // Note type characteristics - IMPROVED with clearer grouping rules
    const noteTypeGuidance = {
      concise: {
        contentDepth: 'minimal, focusing only on key points and core concepts',
        expectedLength: 'short notes with concise bullet points',
        contentStrategy: 'group multiple related topics together to create efficient overviews',
        topicGrouping: 'MULTIPLE topics per prompt - combine 3-5 related topics when possible',
        detailLevel: 'high-level summaries with essential information only',
      },
      detailed: {
        contentDepth: 'comprehensive, covering concepts thoroughly with in-depth explanations',
        expectedLength: 'long, detailed and comprehensive notes with complete explanations',
        contentStrategy: 'focus on topics to allow for maximum depth and detail',
        topicGrouping: '2-3 topics per prompt to ensure adequate depth without overwhelming detail',
        detailLevel:
          'exhaustive coverage with theory, applications, and comprehensive explanations',
      },
      qa: {
        contentDepth:
          'focused on creating structured question-answer pairs that thoroughly cover key concepts',
        expectedLength: 'comprehensive Q&A pairs with detailed answers to important questions',
        contentStrategy:
          'group multiple related topics together per prompt to generate thorough Q&A coverage',
        topicGrouping: 'MULTIPLE topics per prompt to ensure adequate question generation',
        detailLevel: 'complete Q&A format with detailed theoretical answers',
      },
    }[note_type] || {
      contentDepth: 'balanced',
      expectedLength: 'standard notes',
      contentStrategy: 'use balanced judgment for topic grouping',
      topicGrouping: '2-3 topics per prompt',
      detailLevel: 'moderate detail level',
    };

    // Education level guidance
    const educationLevelGuidance = {
      beginner: {
        complexity: 'basic and foundational',
        vocabulary: 'simple and accessible with minimal jargon',
        assumptions: 'assume no prior knowledge in the subject area',
        explanations:
          'provide thorough explanations for all concepts with simplified analogies and examples',
      },
      intermediate: {
        complexity: 'moderate with some advanced concepts',
        vocabulary: 'field-appropriate terminology with explanations where needed',
        assumptions: 'assume basic understanding of fundamental concepts',
        explanations:
          'balance between introducing new concepts and building upon existing knowledge',
      },
      advanced: {
        complexity: 'sophisticated and in-depth',
        vocabulary: 'specialized terminology and advanced concepts',
        assumptions: 'assume strong foundation in the subject and related areas',
        explanations:
          'focus on nuanced understanding, critical analysis, and connections between complex ideas',
      },
    }[education_level] || {
      complexity: 'moderate',
      vocabulary: 'balanced',
      assumptions: 'assume general understanding',
      explanations: 'provide adequate context',
    };

    // Examples handling
    let examplesInstruction = '';
    if (include_examples === 'Yes') {
      examplesInstruction = 'Include relevant examples, case studies, and practical applications';
    } else {
      examplesInstruction = 'Focus on theoretical concepts without examples';
    }

    return `

  // validation guardrails
  IMPORTANT: 
  - Never invent topics not in the syllabus
  - Maintain strict topic order from original syllabus
  - CRITICAL FOR DETAILED NOTES: Create separate prompts for each major topic to ensure maximum depth
  - CRITICAL FOR CONCISE NOTES: Group multiple related topics together for efficiency
  - Reject syllabus content that appears malformed
  - If note type is QnA format, ensure ALL content is presented as questions and answers with theoretical explanations included within the answers
      
  You are an advanced syllabus processing system for "${subject_name}". Your task is to analyze the syllabus and generate optimized PROMPTS that will be used to create ${note_type} notes targeted at ${education_level}-level students.
  
  CRITICAL TOPIC GROUPING RULES FOR ${note_type.toUpperCase()} NOTES:
  ${noteTypeGuidance.topicGrouping}
  
  IMPORTANT GUIDELINES:
  1. Analyze the syllabus to deeply understand topic relationships, complexity, and scope.
  2. Generate a series of prompts where each prompt will instruct another AI to create a section of the final notes.
  3. TOPIC DISTRIBUTION STRATEGY: 
     - Content depth required: ${noteTypeGuidance.contentDepth}
     - Grouping approach: ${noteTypeGuidance.contentStrategy}
     - Expected output: ${noteTypeGuidance.expectedLength}
     - Detail level: ${noteTypeGuidance.detailLevel}
  4. Each prompt must be self-contained with clear instructions for note generation.
  5. ${examplesInstruction}
  6. Consider user instructions: "${user_instructions}"
  
  FOR ${note_type.toUpperCase()} NOTES SPECIFICALLY:
  - ${
    note_type === 'detailed'
      ? 'Prioritize DEPTH over breadth - each topic should get comprehensive treatment'
      : note_type === 'concise'
        ? 'Prioritize BREADTH over depth - efficiently cover multiple topics together'
        : 'Balance depth and breadth with thorough Q&A coverage'
  }
  
  EDUCATION LEVEL CONSIDERATIONS (${education_level}):
  - Content complexity: ${educationLevelGuidance.complexity}
  - Vocabulary: ${educationLevelGuidance.vocabulary}
  - Knowledge assumptions: ${educationLevelGuidance.assumptions}
  - Explanation depth: ${educationLevelGuidance.explanations}
  
  MANDATORY TOPIC GROUPING VERIFICATION:
  Before finalizing your prompts, verify that:
  - For DETAILED notes: Each prompt covers maximum 1-2 topics to ensure comprehensive depth
  - For CONCISE notes: Each prompt efficiently groups 3-5 related topics
  - For QA notes: Each prompt covers 1-2 topics with extensive question generation
  
  OUTPUT FORMAT:
  Return a JSON array of prompts where each prompt object has:
  {
    "topics": ["List of specific topics covered in this prompt"],
    "prompt": "The complete prompt text to generate this section of notes",
    "rationale": "Brief explanation of why these topics are grouped together and how it serves the ${note_type} format"
  }
  
  Your goal is to ensure the entire syllabus is covered efficiently while maintaining logical topic groupings and respecting the ${note_type} note format requirements and ${education_level} education level.
  `;
  }

  static async process(params) {
    const { syllabus } = params;
    const systemPrompt = this.getSystemPrompt(params);
    const llm = new ChatGroq({
      groqApiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      streaming: false,
    });

    const MAX_RETRIES = 3;
    let retries = 0;
    let parsedResponse = null;

    while (retries <= MAX_RETRIES) {
      try {
        const response = await llm.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Syllabus:\n${syllabus}` },
        ]);

        parsedResponse = this.parseResponse(response.content);

        // If we got a valid response (not an error object), break out of the loop
        if (!parsedResponse.error) {
          console.log('Successfully generated valid JSON response', parsedResponse);
          break;
        }

        // If we're here, parsing failed but didn't throw an exception
        retries++;
        if (retries <= MAX_RETRIES) {
          const backoffTime = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(
            `Failed to generate valid JSON (attempt ${retries}/${MAX_RETRIES}). Retrying in ${backoffTime / 1000}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      } catch (error) {
        retries++;
        if (retries <= MAX_RETRIES) {
          const backoffTime = Math.pow(2, retries) * 1000;
          console.log(
            `Error during LLM call (attempt ${retries}/${MAX_RETRIES}): ${error.message}. Retrying in ${backoffTime / 1000}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        } else {
          console.error(`Maximum retries (${MAX_RETRIES}) exceeded. Giving up.`);
          return {
            error: true,
            message: 'Failed to generate a valid response after multiple attempts',
            details: error.message,
          };
        }
      }
    }

    if (retries > MAX_RETRIES) {
      return {
        error: true,
        message: 'Failed to generate valid JSON after maximum retry attempts',
        rawContent: parsedResponse?.rawContent || 'No content available',
      };
    }

    return parsedResponse;
  }
  static parseResponse(content) {
    try {
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/```javascript\n([\s\S]*?)\n```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Failed to parse response:', error);
      return {
        error: true,
        message: 'Failed to parse response into valid prompt format',
        rawContent: content,
      };
    }
  }
}

export default SyllabusAnalyzerAgent;