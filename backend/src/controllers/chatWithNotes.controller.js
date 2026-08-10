import ChatWithNotesAgent from '../agents/ChatWithNotesAgent.js';
import path from 'path';
import fs from 'fs';
// fileURLToPath not needed — using /tmp paths directly
import axios from 'axios';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/user.model.js';
import { NotesRequestModel } from '../models/user-request.model.js';
import { ChatHistoryModel } from '../models/chat-history.model.js';

// Constants — use /tmp for Vercel serverless compatibility
const UPLOADS_DIR = '/tmp/uploads/pdfs';
const VECTOR_STORE_DIR = '/tmp/vectorstores';

// Ensure directories exist (re-created each invocation on Vercel)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(VECTOR_STORE_DIR)) {
  fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept PDFs only
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

async function downloadPdfFromUrl(pdfUrl, requestId) {
  const response = await axios.get(pdfUrl, { responseType: 'stream' });
  const fileName = `reference_${requestId}_${Date.now()}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

/**
 * Controller to upload and process a PDF document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const processPdfController = async (req, res) => {
  try {
    const documentId = `doc-${uuidv4()}`;
    const pdfUrl = req.body.relativeUrl;
    const email = req.body.email;
    const fileName = req.body.fileName;

    const user = await UserModel.find({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    console.log("user:", user);
    const userId = user[0]._id
    if (!pdfUrl || !userId || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'pdfUrl, userId, and fileName are required'
      });
    }
    
    const pdfPath = await downloadPdfFromUrl(pdfUrl, documentId);
    // Process the PDF document to create vector store
    const vectorStorePath = await ChatWithNotesAgent.processPdfDocument(pdfPath, documentId);
    
    // Create a new history entry
    const historyEntry = await NotesRequestModel.create({
      _userID: userId,
      requestId: documentId,
      subject_name: fileName,
      display_name: fileName,
      syllabus: "This is a syllabus for the document",
      type: 'pdf_chat',
      status: 'completed',
      secure_url: pdfUrl,
    });

    // Create initial chat history
    await ChatHistoryModel.create({
      _userID: userId,
      _historyID: historyEntry._id,
      pdfUrl: pdfUrl,
      pdfName: fileName,
      messages: [],
      documentId: documentId
    });
    
    return res.status(200).json({
      success: true,
      message: 'PDF processed successfully',
      data: {
        documentId,
        vectorStorePath,
        originalFilename: fileName
      }
    });
  } catch (error) {
    console.error('Error in uploadPdfController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process PDF',
      error: error.message
    });
  }
};

/**
 * Controller to chat with a processed PDF document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const chatWithPdfController = async (req, res) => {
  try {
    const { documentId, query, options } = req.body;
    const user = req.user;
    
    if (!documentId || !query) {
      return res.status(400).json({
        success: false,
        message: 'documentId and query are required'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    // Construct vector store path from document ID
    const vectorStorePath = path.join(VECTOR_STORE_DIR, documentId);
    
    // Check if vector store exists
    if (!fs.existsSync(vectorStorePath)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found. Please upload and process the PDF first.'
      });
    }
    
    // Process the chat query
    const result = await ChatWithNotesAgent.process({
      vectorStorePath,
      documentId,
      query,
      options: options || {}
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process query',
        error: result.error
      });
    }

    // Find the history entry
    const historyEntry = await NotesRequestModel.findOne({ requestId: documentId });
    if (!historyEntry) {
      return res.status(404).json({
        success: false,
        message: 'History entry not found'
      });
    }

    // Update chat history
    await ChatHistoryModel.findOneAndUpdate(
      { _historyID: historyEntry._id },
      {
        $push: {
          messages: [
            {
              role: 'user',
              content: query,
              timestamp: new Date()
            },
            {
              role: 'assistant',
              content: result.response,
              timestamp: new Date()
            }
          ]
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      data: {
        query: result.query,
        response: result.response,
        relevantContextCount: result.relevantContextCount
      }
    });
  } catch (error) {
    console.error('Error in chatWithPdfController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process query',
      error: error.message
    });
  }
};

/**
 * Controller to handle streaming chat with PDF
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const streamChatWithPdfController = async (req, res) => {
  try {
    const { documentId, query, options } = req.body;
    if (!documentId || !query) {
      return res.status(400).json({
        success: false,
        message: 'documentId and query are required'
      });
    }
    // Construct vector store path from document ID
    const vectorStorePath = path.join(VECTOR_STORE_DIR, documentId);
    
    // Check if vector store exists
    if (!fs.existsSync(vectorStorePath)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found. Please upload and process the PDF first.'
      });
    }
    
    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    let fullResponse = '';
    
    // Define stream callback function
    const streamCallback = (chunk) => {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    };
    
    // Process the streaming chat query
    const result = await ChatWithNotesAgent.process({
      vectorStorePath,
      documentId,
      query,
      streaming: true,
      streamCallback,
      options: options || {}
    });

    // Find the history entry
    const historyEntry = await NotesRequestModel.findOne({ requestId: documentId });
    if (historyEntry) {
      // Update chat history
      await ChatHistoryModel.findOneAndUpdate(
        { _historyID: historyEntry._id },
        {
          $push: {
            messages: [
              {
                role: 'user',
                content: query,
                timestamp: new Date()
              },
              {
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date()
              }
            ]
          }
        }
      );
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({ 
      done: true, 
      relevantContextCount: result.relevantContextCount 
    })}\n\n`);
    
    res.end();
  } catch (error) {
    console.error('Error in streamChatWithPdfController:', error);
    // Send error in SSE format
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

export const reloadPdfAndChatController = async (req, res) => {
  try {
    const { historyId, email } = req.body;
    const user = await UserModel.findOne({ email: email }).then(user => user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    const userId = user._id;

    // Get the user request to find the PDF URL
    const userRequest = await NotesRequestModel.findOne({
      _id: historyId,
      _userID: userId,
      type: 'pdf_chat'
    });

    if (!userRequest) {
      return res.status(404).json({
        success: false,
        message: 'Chat history not found'
      });
    }

    // Get the chat history
    const chatHistory = await ChatHistoryModel.findOne({
      _historyID: historyId,
      _userID: userId
    });

    if (!chatHistory) {
      return res.status(404).json({
        success: false,
        message: 'Chat history not found'
      });
    }

    // Download the PDF from the secure URL
    const pdfPath = await downloadPdfFromUrl(chatHistory.pdfUrl, historyId);

    // Process the PDF and create vector store
    const vectorStorePath = await ChatWithNotesAgent.processPdfDocument(pdfPath, chatHistory.documentId);

    // Return the necessary information for the frontend
    res.json({
      success: true,
      data: {
        historyId,
        pdfName: chatHistory.pdfName,
        messages: chatHistory.messages,
        pdfUrl: chatHistory.pdfUrl,
        vectorStorePath,
        documentId: chatHistory.documentId
      }
    });

  } catch (error) {
    console.error('Error reloading PDF and chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error reloading PDF and chat history',
      error: error.message
    });
  }
};