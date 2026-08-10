import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

dotenv.config();

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_CACHE_DIR = path.join(process.cwd(), "temp", "images");

// Ensure image cache directory exists
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

class ImageGeneratorAgent {
  /**
   * Initializes the Google Gen AI client
   * @returns {GoogleGenAI} The initialized client
   */
  static initializeClient() {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  /**
   * Generates images as base64 strings based on suggestions
   * @param {Array} suggestions - Array of image suggestions
   * @returns {Promise<Array>} - Array of image generation results
   */
  static async generateImagesBase64(suggestions) {
    const results = [];
    console.log("Processing image generation for suggestions:", suggestions);

    const ai = this.initializeClient();
    
    for (const suggestion of suggestions) {
      try {
        const searchTerm = suggestion.searchTerms[0];
        const enhancedPrompt = this.enhancePrompt(searchTerm, suggestion.description);

        const base64Image = await this.generateImageBase64(ai, enhancedPrompt);
        
        if (base64Image) {
          results.push({
            success: true,
            topic: suggestion.topic,
            description: suggestion.description,
            placement: suggestion.placement,
            searchTerm: searchTerm,
            imageData: base64Image,  // Store Base64 encoded image data
          });
          continue;
        }

        // Try backup search term if available
        if (suggestion.searchTerms.length > 1) {
          const backupSearchTerm = suggestion.searchTerms[1];
          const backupEnhancedPrompt = this.enhancePrompt(backupSearchTerm, suggestion.description);
          
          const backupBase64Image = await this.generateImageBase64(ai, backupEnhancedPrompt);
          
          if (backupBase64Image) {
            results.push({
              success: true,
              topic: suggestion.topic,
              description: suggestion.description,
              placement: suggestion.placement,
              searchTerm: backupSearchTerm,
              imageData: backupBase64Image,
            });
            continue;
          }
        }

        // If all attempts fail
        results.push({
          success: false,
          topic: suggestion.topic,
          description: suggestion.description,
          placement: suggestion.placement,
          searchTerm: suggestion.searchTerms.join(", "),
          error: "Failed to generate image",
        });
      } catch (error) {
        console.error(`Error generating image for ${suggestion.topic}:`, error);
        results.push({
          success: false,
          topic: suggestion.topic,
          searchTerm: suggestion.searchTerms.join(", "),
          error: error.message,
        });
      }
    }
    
    return results;
  }

  /**
   * Enhances the prompt for better image generation
   * @param {string} searchTerm - The base search term
   * @param {string} description - The description of what the image should illustrate
   * @returns {string} - Enhanced prompt for image generation
   */
  static enhancePrompt(searchTerm, description) {
    return `
Create a high-quality educational illustration of "${searchTerm}".

Important details:
- Create a ${description}
- Include NO TEXT or labels in the image
- Use clear, contrasting colors
- Keep the design simple and focused on key concepts
- Make it appropriate for educational materials
- Use clean lines and clear visual hierarchy
- Ensure it's easily understood by students

Keywords: ${searchTerm}
`;
  }

  /**
   * Generates a Base64-encoded image
   * @param {GoogleGenAI} ai - The initialized GoogleGenAI client
   * @param {string} prompt - The enhanced prompt for image generation
   * @returns {Promise<string|null>} - Base64 string of the image or null if failed
   */
  static async generateImageBase64(ai, prompt) {
    try {
      console.log(`Generating image for prompt: ${prompt}`);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp-image-generation",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["Text", "Image"],
        },
      });

      // Extract image data
      if (!response.candidates || !response.candidates[0] || !response.candidates[0].content || !response.candidates[0].content.parts) {
        console.error("Invalid response structure from Gemini");
        return null;
      }
      
      let imageData = null;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageData = part.inlineData.data;
          break;
        }
      }
      
      if (!imageData) {
        console.error("No image data found in response");
        return null;
      }

      return imageData;  // Return Base64-encoded image data
    } catch (error) {
      console.error(`Error generating image with Gemini: ${error.message}`);
      return null;
    }
  }
}

export default ImageGeneratorAgent;