import { ChatGroq } from "@langchain/groq";
import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Vercel mounts the deployed bundle at /var/task, which is read-only.
// /tmp is writable in serverless functions; retain the project temp directory locally.
const TEMP_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'temp');
const IMAGE_CACHE_DIR = path.join(TEMP_DIR, 'images');

// Ensure image cache directory exists
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

class ImageSuggestionAgent {
  static getSystemPrompt() {
    return `
You are an expert educational image suggestion system. Your task is to analyze the topics and suggest a LIMITED number of appropriate images that would enhance understanding of the educational content.

IMPORTANT CONSTRAINTS:
1. Suggest a MAXIMUM of 3-5 images TOTAL, regardless of how many topics are provided.
2. Only suggest images for the MOST IMPORTANT concepts that truly benefit from visual explanation.
3. Focus on topics that are abstract, complex, or difficult to understand without visual aid.
4. Prioritize central concepts over supplementary information.
5. Images should NOT contain any text only diagrams, charts, or illustrations.
6. Avoid suggesting copyrighted images from specific textbooks or sources.Instead, opt for generic, widely available images that can be used in a variety of educational contexts.

For each topic you select:
1. Identify ONE key concept that would significantly benefit from visual representation.
2. Suggest specific image search terms that would yield helpful, educational diagrams or illustrations.
3. Prioritize diagrams, charts, and educational illustrations over photographs when appropriate.
4. For STEM topics, focus on technical diagrams, charts, or visual representations of concepts.
5. For humanities, focus on relevant historical images, conceptual diagrams, or visual examples.

Your suggestions should be specific enough to find quality educational images but generic enough to have multiple good results. Avoid suggesting copyrighted images from specific textbooks.

OUTPUT FORMAT:
Return a JSON array where each object contains:
{
  "topic": "The specific topic or concept",
  "searchTerms": ["2-3 specific search terms for images"],
  "description": "Brief description of what the image should illustrate",
  "placement": "Suggestion for where in the notes this image belongs (e.g., 'After introduction', 'Before examples')",
  "importance": "Brief explanation of why this visual is necessary for understanding (1-2 sentences)"
}
`;
  }

  static async generateImageSuggestions(notesSections) {
    try {
      // Extract topics from notes sections
      const topics = notesSections.flatMap(section => section.topics);
      
      const llm = new ChatGroq({
        groqApiKey: process.env.GROQ_API_KEY,
        model: "llama-3.3-70b-versatile", //mixtral-8x7b-32768
      });
      
      console.log("Generating limited image suggestions for topics:", topics.join(", "));
      
      const response = await llm.invoke([
        { role: "system", content: this.getSystemPrompt() },
        { role: "user", content: `Please suggest ONLY the most necessary educational images (maximum 3-5 total) for the following topics in my study notes. Focus exclusively on concepts that truly need visual explanation: ${topics.join(", ")}` }
      ]);
      
      return this.parseResponse(response.content);
    } catch (error) {
      console.error("Error generating image suggestions:", error);
      return [];
    }
  }

  static parseResponse(content) {
    try {
      // Extract JSON if wrapped in code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                        content.match(/```\n([\s\S]*?)\n```/) ||
                        content.match(/```javascript\n([\s\S]*?)\n```/);
      
      const jsonContent = jsonMatch ? jsonMatch[1] : content;
      const suggestions = JSON.parse(jsonContent);
      
      // Ensure we're not exceeding the maximum number of images
      return suggestions.slice(0, 5);
    } catch (error) {
      console.error("Failed to parse image suggestions response:", error);
      return [];
    }
  }

  static integrateImagesIntoMarkdown(markdown, imageResults) {
    let enhancedMarkdown = markdown;
    
    // Sort image results by topic to ensure consistent processing
    const sortedImageResults = [...imageResults].sort((a, b) => a.topic.localeCompare(b.topic));
    
    for (const imageResult of sortedImageResults) {
      if (!imageResult.success || !imageResult.imageData) {
        continue;
      }
      
      // Create markdown image tag with base64 data
      const imageTag = `\n\n![${imageResult.description}](data:image/png;base64,${imageResult.imageData})\n*Figure: ${imageResult.description}*\n\n`;
      
      // Find appropriate insertion point based on topic and placement
      // First try to find exact topic heading
      const topicRegex = new RegExp(`## ${imageResult.topic}|### ${imageResult.topic}`, 'i');
      const topicMatch = enhancedMarkdown.match(topicRegex);
      
      if (topicMatch) {
        // Insert after the heading and first paragraph
        const insertionPoint = this.findInsertionPoint(enhancedMarkdown, topicMatch.index);
        enhancedMarkdown = enhancedMarkdown.substring(0, insertionPoint) + 
                            imageTag + 
                            enhancedMarkdown.substring(insertionPoint);
      } else {
        // If exact topic not found, look for a section containing the topic keywords
        const words = imageResult.topic.split(/\s+/).filter(word => word.length > 3);
        for (const word of words) {
          if (word.length <= 3) continue; // Skip short words
          
          const keywordRegex = new RegExp(`## .*${word}.*|### .*${word}.*`, 'i');
          const keywordMatch = enhancedMarkdown.match(keywordRegex);
          
          if (keywordMatch) {
            const insertionPoint = this.findInsertionPoint(enhancedMarkdown, keywordMatch.index);
            enhancedMarkdown = enhancedMarkdown.substring(0, insertionPoint) + 
                               imageTag + 
                               enhancedMarkdown.substring(insertionPoint);
            break;
          }
        }
      }
    }
    
    return enhancedMarkdown;
  }

  static findInsertionPoint(text, startIndex) {
    // Find the end of the first paragraph after the heading
    const textAfterHeading = text.substring(startIndex);
    
    // Look for the next empty line which typically marks paragraph end
    const paragraphEndMatch = textAfterHeading.match(/\n\s*\n/);
    if (paragraphEndMatch) {
      return startIndex + paragraphEndMatch.index + paragraphEndMatch[0].length;
    }
    
    // If no paragraph end found, look for the next heading
    const nextHeadingMatch = textAfterHeading.match(/\n##/);
    if (nextHeadingMatch) {
      return startIndex + nextHeadingMatch.index;
    }
    
    // If neither found, just insert at the end of the heading line
    const lineEndMatch = textAfterHeading.match(/\n/);
    if (lineEndMatch) {
      return startIndex + lineEndMatch.index + 1;
    }
    
    // Fallback to original position
    return startIndex;
  }
}

export default ImageSuggestionAgent;
