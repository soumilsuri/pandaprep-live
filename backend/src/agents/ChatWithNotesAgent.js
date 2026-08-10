import { GoogleGenAI } from '@google/genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Use /tmp for Vercel serverless compatibility (ephemeral but writable)
const PDF_CACHE_DIR = '/tmp/pdfs';
const VECTOR_STORE_DIR = '/tmp/vectorstores';

// Ensure directories exist (will be re-created on each cold start on Vercel)
[PDF_CACHE_DIR, VECTOR_STORE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Lazily loads PDFLoader to avoid issues with missing native deps at module load time.
 */
async function getPDFLoader() {
  const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');
  return PDFLoader;
}

/**
 * Lazily loads FaissStore to avoid native binary crash at module load time.
 * faiss-node is a native C++ addon and may not be available on all environments.
 */
async function getFaissStore() {
  try {
    const { FaissStore } = await import('@langchain/community/vectorstores/faiss');
    return FaissStore;
  } catch (err) {
    throw new Error(
      'FAISS vector store is not available in this environment. This feature is temporarily disabled.'
    );
  }
}

class ChatWithNotesAgent {
  // Add a static map to store chat histories
  static chatHistories = new Map();

  /**
   * Get or create chat history for a document
   * @param {string} documentId - The document identifier
   * @returns {Array} - The chat history array
   */
  static getChatHistory(documentId) {
    if (!this.chatHistories.has(documentId)) {
      this.chatHistories.set(documentId, []);
    }
    return this.chatHistories.get(documentId);
  }

  /**
   * Add a message to chat history
   * @param {string} documentId - The document identifier
   * @param {Object} message - The message object
   */
  static addToChatHistory(documentId, message) {
    const history = this.getChatHistory(documentId);
    history.push(message);
  }

  /**
   * Initialize the Google Generative AI client
   * @returns {GoogleGenAI} The initialized client
   */
  static initializeClient() {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  /**
   * Get the instruction prompt for the model
   * @param {Object} options - Options for customizing the prompt
   * @param {Array} chatHistory - Previous chat messages
   * @returns {string} - The instruction prompt
   */
  static getInstructionPrompt(options = {}, chatHistory = []) {
    const basePrompt = `You are an intelligent assistant analyzing a PDF document. Your task is to provide accurate, natural, and contextually relevant responses based on the document content provided below.

Instructions:
1. Base your responses ONLY on the provided document excerpts
2. If the answer cannot be found in the provided context, say so clearly
3. Avoid repeating the exact same response for different questions
4. Provide specific details and examples from the document when relevant
5. Maintain a natural, conversational tone while being precise and informative
6. If asked about the document owner or subject, refer to them in third person
7. Format your response appropriately (lists for multiple items, paragraphs for explanations)
8. If the question is about personal information, be discreet and professional

${
  chatHistory.length > 0
    ? '\nPrevious conversation context:\n' +
      chatHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n') +
      '\n'
    : ''
}

Context from the document is provided below, marked as "Document Excerpt":

`;
    return basePrompt;
  }

  /**
   * Process PDF using standard text extraction
   * @param {string} filePath - Path to the PDF file
   * @param {string} documentId - Unique identifier for the document
   * @returns {Promise<Array>} Array of document objects
   */
  static async processPdfStandard(filePath, documentId) {
    console.log(`Processing PDF with standard extraction: ${filePath}`);

    const PDFLoader = await getPDFLoader();
    const loader = new PDFLoader(filePath, { splitPages: true });
    const docs = await loader.load();

    // Add extraction method metadata
    docs.forEach((doc, index) => {
      doc.metadata = {
        ...doc.metadata,
        extractionMethod: 'standard',
        documentId: documentId,
        page: index + 1,
      };
    });

    console.log(`Standard extraction: ${docs.length} pages processed`);
    return docs;
  }

  /**
   * Process and index a PDF document
   * @param {string} filePath - Path to the PDF file
   * @param {string} documentId - Unique identifier for the document
   * @param {Object} options - Processing options (maintained for compatibility)
   * @returns {Promise<string>} - Path to the vector store
   */
  static async processPdfDocument(filePath, documentId, options = {}) {
    console.log(`Processing PDF document: ${filePath}`);

    const FaissStore = await getFaissStore();

    // Check if vector store already exists
    const vectorStorePath = path.join(VECTOR_STORE_DIR, documentId);
    if (fs.existsSync(vectorStorePath)) {
      console.log('Vector store already exists, using cached version');
      return vectorStorePath;
    }

    // Process PDF using standard text extraction
    const docs = await this.processPdfStandard(filePath, documentId);

    if (!docs || docs.length === 0) {
      throw new Error('No content could be extracted from the PDF');
    }

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`Split into ${splitDocs.length} chunks`);

    // Create embeddings using Google's text embedding model
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: 'models/text-embedding-004',
    });

    // Create and save vector store
    console.log('Creating vector store...');
    const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
    await vectorStore.save(vectorStorePath);

    console.log(`Vector store saved to ${vectorStorePath}`);
    return vectorStorePath;
  }

  /**
   * Load a vector store from disk
   * @param {string} vectorStorePath - Path to the vector store
   * @returns {Promise<FaissStore>} - The loaded vector store
   */
  static async loadVectorStore(vectorStorePath) {
    console.log(`Loading vector store from ${vectorStorePath}`);

    const FaissStore = await getFaissStore();

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: 'models/text-embedding-004',
    });

    return await FaissStore.load(vectorStorePath, embeddings);
  }

  /**
   * Retrieve relevant context from the vector store
   * @param {FaissStore} vectorStore - The vector store to search
   * @param {string} query - The user's question
   * @param {number} count - Number of relevant documents to retrieve
   * @returns {Promise<string>} - The formatted context string
   */
  static async retrieveContext(vectorStore, query, count = 5) {
    // Get relevant documents
    const relevantDocs = await vectorStore.similaritySearch(query, count);

    // Format context with clear separation and metadata
    const formattedContext = relevantDocs
      .map((doc, index) => {
        const metadata = doc.metadata || {};
        return `Document Excerpt ${index + 1}:
Source: Page ${metadata.page || 'N/A'}
${metadata.type === 'summary' ? '[Document Summary]' : ''}

${doc.pageContent.trim()}
-------------------
`;
      })
      .join('\n');

    return formattedContext;
  }

  /**
   * Chat with a PDF document
   * @param {string} query - The user's question
   * @param {string} documentId - Unique identifier for the document
   * @param {string} vectorStorePath - Path to the vector store
   * @param {Object} options - Options for customizing the response
   * @returns {Promise<Object>} - The chat response
   */
  static async chat(query, documentId, vectorStorePath, options = {}) {
    console.log(`Processing chat query: ${query}`);

    try {
      // Load vector store
      const vectorStore = await this.loadVectorStore(vectorStorePath);

      // Get relevant context
      const context = await this.retrieveContext(vectorStore, query, options.retrievalCount || 5);

      // Get chat history
      const chatHistory = this.getChatHistory(documentId);

      // Get instruction prompt with chat history
      const instructionPrompt = this.getInstructionPrompt(options, chatHistory);

      // Initialize Gemini model
      const genAI = this.initializeClient();

      // Prepare content for generation
      const contents = [
        {
          role: 'user',
          parts: [{ text: `${instructionPrompt}\n\n${context}\n\nUser question: ${query}` }],
        },
      ];

      // Generate response
      console.log('Generating response...');
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: contents,
      });

      // Check response
      if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
        throw new Error('Invalid response structure from Gemini');
      }

      // Extract response text
      const responseText = response.candidates[0].content.parts[0].text || '';

      // Add messages to chat history
      this.addToChatHistory(documentId, { role: 'user', content: query });
      this.addToChatHistory(documentId, { role: 'assistant', content: responseText });

      return {
        success: true,
        query,
        response: responseText,
        relevantContextCount: context.split('Document Excerpt').length - 1,
      };
    } catch (error) {
      console.error('Error in chat:', error);
      return {
        success: false,
        query,
        error: error.message,
      };
    }
  }

  /**
   * Chat with a PDF document with streaming response
   * @param {string} query - The user's question
   * @param {string} documentId - Unique identifier for the document
   * @param {string} vectorStorePath - Path to the vector store
   * @param {Object} options - Options for customizing the response
   * @param {Function} streamCallback - Callback for streaming response chunks
   * @returns {Promise<Object>} - The chat response
   */
  static async chatStreaming(query, documentId, vectorStorePath, options = {}, streamCallback) {
    console.log(`Processing streaming chat query: ${query}`);

    try {
      // Load vector store
      const vectorStore = await this.loadVectorStore(vectorStorePath);

      // Get relevant context
      const context = await this.retrieveContext(vectorStore, query, options.retrievalCount || 5);

      // Get chat history
      const chatHistory = this.getChatHistory(documentId);

      // Get instruction prompt with chat history
      const instructionPrompt = this.getInstructionPrompt(options, chatHistory);

      // Initialize Gemini model
      const genAI = this.initializeClient();

      // Prepare content for generation
      const contents = [
        {
          role: 'user',
          parts: [{ text: `${instructionPrompt}\n\n${context}\n\nUser question: ${query}` }],
        },
      ];

      // Generate streaming response
      console.log('Generating streaming response...');
      const response = await genAI.models.generateContentStream({
        model: 'gemini-2.0-flash-lite',
        contents: contents,
      });

      let fullResponse = '';

      // Process the stream
      for await (const chunk of response) {
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
        fullResponse += chunkText;

        // Call the stream callback if provided
        if (streamCallback && typeof streamCallback === 'function') {
          streamCallback(chunkText, fullResponse);
        }
      }

      // Add messages to chat history
      this.addToChatHistory(documentId, { role: 'user', content: query });
      this.addToChatHistory(documentId, { role: 'assistant', content: fullResponse });

      return {
        success: true,
        query,
        response: fullResponse,
        relevantContextCount: context.split('Document Excerpt').length - 1,
      };
    } catch (error) {
      console.error('Error in streaming chat:', error);
      if (streamCallback && typeof streamCallback === 'function') {
        streamCallback('', '', error);
      }
      return {
        success: false,
        query,
        error: error.message,
      };
    }
  }

  /**
   * Main entry point for using the agent
   * @param {Object} params - Parameters for the chatbot
   * @returns {Promise<Object>} - The result of processing
   */
  static async process(params) {
    const {
      pdfPath,
      documentId = `doc-${Date.now()}`,
      query,
      streaming = false,
      streamCallback,
      options = {},
      processingOptions = {}, // Maintained for compatibility
    } = params;

    try {
      // Process PDF document if pdfPath is provided
      let vectorStorePath;
      if (pdfPath) {
        vectorStorePath = await this.processPdfDocument(pdfPath, documentId, processingOptions);
      } else if (params.vectorStorePath) {
        vectorStorePath = params.vectorStorePath;
      } else {
        throw new Error('Either pdfPath or vectorStorePath must be provided');
      }

      // Chat with the document
      if (streaming && typeof streamCallback === 'function') {
        return await this.chatStreaming(
          query,
          documentId,
          vectorStorePath,
          options,
          streamCallback
        );
      } else {
        return await this.chat(query, documentId, vectorStorePath, options);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Utility method to clean up temporary files and directories
   * @param {string} documentId - Document ID to clean up
   */
  static async cleanup(documentId) {
    const pathsToClean = [path.join(VECTOR_STORE_DIR, documentId)];

    for (const dirPath of pathsToClean) {
      try {
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`Cleaned up: ${dirPath}`);
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up ${dirPath}:`, error.message);
      }
    }
  }
}

export default ChatWithNotesAgent;
