import { ChatGroq } from '@langchain/groq';
import dotenv from 'dotenv';
import ChatWithNotesAgent from './ChatWithNotesAgent.js';

dotenv.config();

class NotesGeneratorAgent {
  static getSystemPrompt(params = {}) {
    const {
      note_type = 'detailed',
      include_examples = 'No',
      education_level = 'intermediate', // Added education_level parameter
      user_instructions = '',
    } = params;

    // Define formatting and content style based on note type
    const noteTypeConfig = {
      concise: {
        format: 'Use concise bullet points with minimal explanation',
        depth: 'Focus on core concepts and definitions only',
        length: 'Keep sections brief (150-250 words per major topic)',
        structure:
          '- Use ## for main topics\n- Use bullet points extensively\n- Minimize paragraph text',
      },
      detailed: {
        format: 'Use comprehensive paragraphs with thorough explanations',
        depth: 'Cover concepts in depth with supporting details',
        length: 'Provide substantial content (400-600 words per major topic)',
        structure:
          '- Use ## for main topics\n- Use ### for subtopics\n- Use bullet points for lists of features/characteristics\n- Use paragraphs for explanations',
      },
      qa: {
        format: 'Structure ALL content as clear questions followed by comprehensive answers',
        depth: 'Create questions that test understanding and provide detailed, explanatory answers',
        length:
          'Include 3-5 questions per topic with substantial answers (50-150 words per answer)',
        structure:
          '- Use ## for topic areas\n- Format EVERY concept as "**Q:** [Specific question about the concept]"\n- Follow IMMEDIATELY with a new line then "**A:** [Comprehensive answer with explanations]"\n- Ensure NO content appears outside this Q&A structure\n- Group related questions under appropriate headings',
      },
    }[note_type] || {
      format: 'Use a balanced approach with bullet points and explanations',
      depth: 'Cover main concepts with sufficient detail',
      length: 'Aim for medium length (300-500 words per major topic)',
      structure: '- Use ## for main topics\n- Use a mix of paragraphs and bullet points',
    };

    // Education level configuration - NEW
    const educationLevelConfig = {
      beginner: {
        complexity: 'Use simple language and explain all technical terms',
        assumptions: 'Assume no prior knowledge of the subject',
        explanations: 'Provide thorough explanations with everyday analogies',
        vocabulary: 'Use basic vocabulary with clear definitions for all technical terms',
        examples: 'Include very simple, concrete examples that relate to common experiences',
      },
      intermediate: {
        complexity: 'Use moderately technical language with some specialized terminology',
        assumptions: "Assume basic familiarity with the subject's fundamentals",
        explanations: 'Provide clear explanations that build on foundational knowledge',
        vocabulary: 'Use field-appropriate vocabulary with brief explanations for advanced terms',
        examples: 'Include practical examples that demonstrate application of concepts',
      },
      advanced: {
        complexity: 'Use sophisticated, technical language appropriate for specialists',
        assumptions: 'Assume strong prior knowledge of the subject and related areas',
        explanations: 'Focus on nuanced understanding and critical analysis',
        vocabulary: 'Use specialized terminology without explaining basic concepts',
        examples: 'Include complex, nuanced examples that illustrate advanced applications',
      },
    }[education_level] || {
      complexity: 'Use balanced language with appropriate technical terms',
      assumptions: 'Assume moderate familiarity with the subject',
      explanations: 'Provide clear explanations with appropriate depth',
      vocabulary: 'Use contextually appropriate vocabulary with explanations as needed',
      examples: 'Include helpful examples that clarify concepts',
    };

    // Example handling
    let examplesConfig = '';
    if (include_examples === 'Yes') {
      examplesConfig = `Include relevant examples to illustrate concepts. ${educationLevelConfig.examples}`;
    } else {
      examplesConfig = 'Focus on theoretical concepts without examples';
    }

    return `
  You are an expert educational content generator creating high-quality study notes. Your task is to generate ${note_type} notes targeted at ${education_level}-level students, following these specifications:
  
  CONTENT GUIDELINES:
  1. ${noteTypeConfig.format}
  2. ${noteTypeConfig.depth}
  3. ${examplesConfig}
  4. Highlight key definitions, theorems, and important concepts in **bold**
  5. Include relevant formulas with clear explanations where appropriate
  6. ${noteTypeConfig.length}
  7. Use clear, academic language accessible to ${education_level}-level students
  8. Address user-specific instructions: "${user_instructions}"
  9. If note type is a QnA format, ensure ALL content is presented as questions and answers with theoretical explanations included within the answers
  10. When reference material is provided, integrate it naturally into your notes while ensuring accuracy and relevance
  11. dont provide any additional commentary or introduction, just the notes content

  EDUCATION LEVEL GUIDELINES (${education_level}):
  1. Content complexity: ${educationLevelConfig.complexity}
  2. Knowledge assumptions: ${educationLevelConfig.assumptions}
  3. Explanation depth: ${educationLevelConfig.explanations}
  4. Vocabulary usage: ${educationLevelConfig.vocabulary}
  
  FORMATTING INSTRUCTIONS:
  1. Use proper markdown formatting throughout
  2. Structure content following this hierarchy:
     ${noteTypeConfig.structure}
  3. When writing mathematical formulas, follow these STRICT GUIDELINES:
     - Use single dollar signs for inline formulas: $formula$
     - Use double dollar signs for display equations: $$formula$$
     - AVOID using LaTeX text commands like \\text{} when possible
     - For fractions, use \\frac{numerator}{denominator}
     - Use simple math operators: +, -, ×, ÷, =, <, >, ≤, ≥
     - For superscripts use ^ and for subscripts use _ 
     - For multiple character superscripts/subscripts, use curly braces: x_{123}
     - Keep formulas as simple as possible while preserving meaning
     - NEVER include backticks or markdown code formatting around LaTeX formulas
     - NEVER write the word "LaTeX" or explain that you're using LaTeX - just write the formulas
     - For simple symbols like α, β, γ use the direct Unicode characters when possible
     - For complex operations and environments use standard LaTeX notation
     - For integrals use \\int_{lower}^{upper} expression
     - For sums use \\sum_{lower}^{upper} expression
     - For limits use \\lim_{x \\to value} expression
     - **IMPORTANT: When writing about programming languages or code that contains literal dollar signs (like PHP variables), ALWAYS wrap such content in code blocks using backticks to prevent MathJax rendering conflicts**
     - **Use \`$variable\` for inline code with dollar signs, or \`\`\`code blocks\`\`\` for multi-line code examples**
  4. Use tables for comparative information when useful
  5. Make sure headings follow a logical hierarchy
  
  Your output should be comprehensive, well-structured study material at the ${education_level} level that directly addresses the topics provided. Generate ONLY the final notes content, properly formatted in markdown.
  `;
  }

  static async retrieveSectionContext(sectionTopic, params) {
    if (!params.vectorStorePath || !params.documentId) {
      return '';
    }

    try {
      const contextQuery =
        `${sectionTopic} ${params.subject_name || ''} explanation examples`.trim();

      // Load the vector store directly using the imported function
      const vectorStore = await ChatWithNotesAgent.loadVectorStore(params.vectorStorePath);

      // Retrieve context directly using the imported function
      const context = await ChatWithNotesAgent.retrieveContext(vectorStore, contextQuery, 3);

      if (context && context.trim().length > 0) {
        return `\n\nRELEVANT REFERENCE MATERIAL:\n${context}\n\n`;
      }
    } catch (error) {
      console.warn(`Failed to retrieve context for section "${sectionTopic}":`, error.message);
    }

    return '';
  }

  static async generate(prompt, params = {}, requestId = null) {
    const noteType = params.note_type || 'detailed';
    const promptText =
      typeof prompt === 'string' ? prompt : prompt.prompt || JSON.stringify(prompt);

    // Extract section topic for context retrieval - use entire JSON object as string
    let sectionTopic = '';
    if (typeof prompt === 'object') {
      sectionTopic = JSON.stringify(prompt);
    } else if (typeof prompt === 'string') {
      sectionTopic = prompt;
    }

    // Retrieve context if vector store is available
    let sectionContext = '';
    console.log(`Retrieving context for section: "${sectionTopic}" with params:`, params);
    if (params.vectorStorePath && params.documentId && sectionTopic) {
      sectionContext = await this.retrieveSectionContext(sectionTopic, params);
    }

    // Combine prompt with context
    const enhancedPrompt = promptText + sectionContext;
    const systemPrompt = this.getSystemPrompt(params);

    // Use Groq Llama for all note types (concise, detailed, qa)
    const llm = new ChatGroq({
      groqApiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      streaming: false,
    });

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedPrompt },
    ]);

    const content = response.content;

    console.log(
      `[NotesGeneratorAgent] Section generated. Context used: ${sectionContext.length > 0 ? 'Yes' : 'No'}`
    );

    return this.formatResponse(content);
  }

  static formatResponse(content) {
    // Clean up markdown if necessary
    let cleanedContent = content;

    // Remove markdown code block indicators if present
    if (content.startsWith('```markdown') || content.startsWith('```md')) {
      cleanedContent = content.replace(/^```(markdown|md)\n/, '').replace(/\n```$/, '');
    } else if (content.startsWith('```') && content.endsWith('```')) {
      cleanedContent = content.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    return cleanedContent;
  }

  static async generateMultipleNotes(prompts, params = {}, requestId = null) {
    // Process an array of prompts from SyllabusAnalyzerAgent
    const results = [];
    const totalPrompts = prompts.length;

    console.log(`[NotesGeneratorAgent] Generating ${totalPrompts} sections...`);

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const currentTopics = prompt.topics || [];

      console.log(
        `[NotesGeneratorAgent] Generating section ${i + 1}/${totalPrompts}: ${currentTopics.join(', ')}`
      );

      // Generate notes with context for this specific section
      const content = await this.generate(prompt, params, requestId);

      console.log(`[NotesGeneratorAgent] Section ${i + 1}/${totalPrompts} complete.`);

      results.push({
        topics: currentTopics,
        content: content,
        promptUsed: prompt.prompt || 'Custom prompt',
      });
    }

    console.log(`[NotesGeneratorAgent] All ${totalPrompts} sections generated.`);
    return results;
  }

  static combineNotes(notesArray, requestId = null) {
    // Combine multiple notes sections into a single document
    console.log(`[NotesGeneratorAgent] Combining ${notesArray.length} sections into final document...`);

    let combinedNotes = '# Complete Study Notes\n\n';
    let tableOfContents = '## Table of Contents\n\n';

    notesArray.forEach((noteSection, index) => {
      // Add to table of contents
      const topicsList = noteSection.topics.join(', ');
      tableOfContents += `${index + 1}. [${topicsList}](#section-${index + 1})\n`;

      // Add section with anchor
      combinedNotes += `\n<a id="section-${index + 1}"></a>\n\n`;
      combinedNotes += noteSection.content + '\n\n---\n\n';
    });

    const finalDocument = tableOfContents + '\n\n---\n\n' + combinedNotes;

    console.log(`[NotesGeneratorAgent] Document combined successfully.`);
    return finalDocument;
  }
}

export default NotesGeneratorAgent;
