// File: controllers/pipeline.controller.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import NotesGeneratorAgent from '../agents/NotesGeneratorAgent.js';
import SyllabusAnalyzerAgent from '../agents/SyllabusAnalyzerAgent.js';
import ImageSuggestionAgent from '../agents/ImageSuggestionAgent.js';
import ImageGeneratorAgent from '../agents/ImageGeneratorAgent.js';
import { NotesRequestModel } from '../models/user-request.model.js';
import { UserModel } from '../models/user.model.js';
import { uploadPDFToCloudinary } from '../utils/cloudinary-file-upload.util.js';
import { addWatermarkToPdf } from '../utils/pdf-watermark-addition.util.js';
import { convertLatexToMathJax } from '../utils/latex-to-image.util.js';
import { addToQueue, getQueueStatus } from '../utils/queue-config.js';
import { convertMarkdownToPdf } from '../utils/markdown-to-pdf.util.js';
import axios from 'axios';
import { sendNotesReadyEmail } from '../utils/email.util.js';
import ChatWithNotesAgent from '../agents/ChatWithNotesAgent.js';

dotenv.config();

// Constants — use /tmp for Vercel serverless compatibility (writable ephemeral storage)
const OUTPUT_DIR = '/tmp';
const DEFAULT_FILENAME = 'study_notes';

// Ensure temp directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Validates the request body
 * @param {Object} body - The request body to validate
 * @returns {Object} - { isValid, error }
 */
function validateRequest(body) {
  const error = [];

  if (!body.syllabus) {
    error.push('Syllabus is required');
  }

  if (!body.subject_name) {
    error.push('Subject name is required');
  }

  if (body.subject_name && typeof body.subject_name !== 'string') {
    error.push('Subject name must be a string');
  }

  if (body.note_type && !['concise', 'detailed', 'qa'].includes(body.note_type.toLowerCase())) {
    error.push('Note type must be one of: concise, detailed, qa');
  }

  if (body.include_examples && !['yes', 'no'].includes(body.include_examples)) {
    error.push("include_examples must be 'yes' or 'no'");
  }

  if (body.include_images && !['yes', 'no'].includes(body.include_images)) {
    error.push("include_images must be 'yes' or 'no'");
  }

  if (
    body.education_level &&
    !['beginner', 'intermediate', 'advanced'].includes(body.education_level.toLowerCase())
  ) {
    error.push('education_level must be one of: beginner, intermediate, advanced');
  }

  return {
    isValid: error.length === 0,
    error,
  };
}

async function downloadPdfFromUrl(pdfUrl, requestId) {
  const response = await axios.get(pdfUrl, { responseType: 'stream' });
  const fileName = `reference_${requestId}_${Date.now()}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

/**
 * Initiates the notes generation process and returns a requestId for status polling
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export async function generateNotesController(req, res) {
  // Generate a unique requestId for this process
  const requestId = uuidv4();
  const startTime = Date.now();

  console.log(`[${requestId}] Initiating notes generation request`);

  try {
    // Validate request
    const { isValid, error } = validateRequest(req.body);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error,
      });
    }

    const {
      email,
      syllabus,
      subject_name = 'General Subject',
      note_type = 'concise',
      include_examples = 'no',
      include_images = 'no',
      education_level = 'intermediate',
      user_instructions = '',
      relativePathToReferenceMaterial = null,
    } = req.body;
    const format = req.body.format || 'pdf';
    const userDoc = await UserModel.findOne({ email: email });

    // Store request in database
    const request = await NotesRequestModel.create({
      _userID: userDoc._id,
      subject_name,
      display_name: subject_name,
      syllabus,
      note_type,
      include_examples,
      include_images,
      education_level,
      user_instructions,
      relativePathToReferenceMaterial,
      format,
      status: 'pending',
      created_at: new Date(),
      requestId: requestId,
    });

    if (request.note_type === 'detailed' || request.include_images === 'yes') {
      if (userDoc.subscription.credits <= 0) {
        await request.updateOne({
          status: 'failed',
          error_message: 'Insufficient credits for this request',
        });
        return res.status(400).json({
          success: false,
          error: 'Insufficient credits for this request',
        });
      }
    }

    // Add the job to the queue
    const job = await addToQueue(requestId, {
      requestBody: req.body,
      requestIdDb: request._id,
      userId: request._userID,
    });

    await request.updateOne({
      status: 'queued',
    });

    // Return the requestId immediately — client will poll /generation-status/:requestId
    res.status(202).json({
      success: true,
      message: 'Notes generation queued',
      requestId: requestId,
      jobId: job.id,
      estimatedTimeSeconds: calculateEstimatedTime(
        syllabus.length,
        note_type,
        include_images,
        education_level
      ),
    });
  } catch (error) {
    console.error(`[${requestId}] Controller error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate notes generation',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
}

/**
 * Cleanup function to remove temporary files after processing
 */
async function cleanupTempFiles(requestId, requestOutputDir, zipPath = null, referencePdfPath = null, vectorStorePath = null) {
  console.log(`[${requestId}] Starting cleanup of temporary files...`);
  
  const filesToClean = [];
  const dirsToClean = [];

  try {
    // 1. Clean up request output directory (contains markdown and PDF)
    if (requestOutputDir && fs.existsSync(requestOutputDir)) {
      dirsToClean.push(requestOutputDir);
      console.log(`[${requestId}] Marked request directory for cleanup: ${requestOutputDir}`);
    }

    // 2. Clean up ZIP file
    if (zipPath && fs.existsSync(zipPath)) {
      filesToClean.push(zipPath);
      console.log(`[${requestId}] Marked ZIP file for cleanup: ${zipPath}`);
    }

    // 3. Clean up reference PDF (if not already cleaned)
    if (referencePdfPath && fs.existsSync(referencePdfPath)) {
      filesToClean.push(referencePdfPath);
      console.log(`[${requestId}] Marked reference PDF for cleanup: ${referencePdfPath}`);
    }

    // 4. Clean up vector store files
    if (vectorStorePath && fs.existsSync(vectorStorePath)) {
      const stats = fs.statSync(vectorStorePath);
      if (stats.isDirectory()) {
        dirsToClean.push(vectorStorePath);
      } else {
        filesToClean.push(vectorStorePath);
      }
      console.log(`[${requestId}] Marked vector store for cleanup: ${vectorStorePath}`);
    }

    // Delete individual files
    for (const file of filesToClean) {
      try {
        fs.unlinkSync(file);
        console.log(`[${requestId}] ✓ Deleted file: ${file}`);
      } catch (error) {
        console.warn(`[${requestId}] ⚠ Failed to delete file ${file}:`, error.message);
      }
    }

    // Delete directories recursively
    for (const dir of dirsToClean) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`[${requestId}] ✓ Deleted directory: ${dir}`);
      } catch (error) {
        console.warn(`[${requestId}] ⚠ Failed to delete directory ${dir}:`, error.message);
      }
    }

    console.log(`[${requestId}] Cleanup completed successfully`);
  } catch (error) {
    console.error(`[${requestId}] Error during cleanup:`, error);
  }
}

/**
 * Main function to generate notes (runs in background via queue)
 * EXPORTED so it can be imported by the worker
 * @param {string} requestId - Unique ID for this request
 * @param {Object} requestBody - The original request body
 * @param {string} requestIdDb - Database ID for the request
 * @param {string} _userId - User ID
 */
export async function generateNotes(requestId, requestBody, requestIdDb, _userId) {
  const startTime = Date.now();
  let markdownPath = null;
  let pdfPath = null;
  let filePrefix = DEFAULT_FILENAME;
  let imageResults = [];
  let downloadUrl = '';
  let content = '';

  let referencePdfPath = null;
  let vectorStorePath = null;
  let documentId = null;
  let requestOutputDir = null;
  let zipPath = null;

  // Handle reference PDF download and processing (FAISS context — kept for compatibility)
  if (requestBody.relativePathToReferenceMaterial) {
    try {
      console.log(`[${requestId}] Downloading reference PDF...`);
      referencePdfPath = await downloadPdfFromUrl(requestBody.relativePathToReferenceMaterial, requestId);
      documentId = `ref-${requestId}`;
      console.log(`[${requestId}] Reference PDF downloaded to ${referencePdfPath}`);
      
      console.log(`[${requestId}] Processing reference PDF for context...`);
      vectorStorePath = await ChatWithNotesAgent.processPdfDocument(referencePdfPath, documentId);
    } catch (error) {
      console.warn(`[${requestId}] Failed to process reference PDF (continuing without context):`, error.message);
    }
  }

  try {
    const {
      syllabus,
      subject_name = 'General Subject',
      note_type = 'concise',
      include_examples = 'no',
      include_images = 'no',
      education_level = 'intermediate',
      user_instructions = '',
      relativePathToReferenceMaterial = null,
    } = requestBody;
    const format = requestBody.format || 'pdf';

    console.log(
      `[${requestId}] Generating ${note_type} notes for ${subject_name} at ${education_level} level`
    );

    // Prepare parameters for agents
    const params = {
      subject_name,
      syllabus,
      note_type: note_type.toLowerCase(),
      include_examples,
      include_images,
      education_level,
      user_instructions,
      relativePathToReferenceMaterial,
      vectorStorePath,
      documentId,
      hasReferenceContext: !!vectorStorePath
    };

    await NotesRequestModel.updateOne(
      { _id: requestIdDb },
      {
        status: 'processing',
      }
    );

    // Step 1: Generate analysis and prompts
    console.log(`[${requestId}] Analyzing syllabus...`);
    const promptsList = await SyllabusAnalyzerAgent.process(params);

    if (!promptsList || promptsList.error) {
      throw new Error(`Failed to analyze syllabus: ${promptsList?.error || 'Invalid response'}`);
    }

    console.log(`[${requestId}] Generated ${promptsList.length} section prompts`);

    // Step 2: Generate notes for each prompt
    console.log(`[${requestId}] Generating notes content...`);
    const notesResults = await NotesGeneratorAgent.generateMultipleNotes(
      promptsList,
      params,
      requestId
    );

    // Step 3: Handle image suggestions and integration if enabled
    let combinedMarkdown = '';
    if (include_images === 'yes') {
      console.log(`[${requestId}] Generating image suggestions...`);
      const imageSuggestions = await ImageSuggestionAgent.generateImageSuggestions(notesResults);

      console.log(`[${requestId}] Generating images using Gemini...`);
      imageResults = await ImageGeneratorAgent.generateImagesBase64(imageSuggestions);

      combinedMarkdown = NotesGeneratorAgent.combineNotes(notesResults, requestId);

      console.log(
        `[${requestId}] Integrating ${imageResults.filter((img) => img.success).length} images into notes...`
      );
      combinedMarkdown = ImageSuggestionAgent.integrateImagesIntoMarkdown(
        combinedMarkdown,
        imageResults
      );
    } else {
      combinedMarkdown = NotesGeneratorAgent.combineNotes(notesResults, requestId);
    }

    // Prepare filename
    const sanitizedSubject = subject_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    filePrefix = `${sanitizedSubject}_${note_type}_${education_level}_${timestamp}`;

    // Create a dedicated output directory for this request inside /tmp
    requestOutputDir = path.join(OUTPUT_DIR, requestIdDb.toString());
    if (!fs.existsSync(requestOutputDir)) {
      fs.mkdirSync(requestOutputDir, { recursive: true });
    }

    // Step 4: Process LaTeX formulas with MathJax
    console.log(`[${requestId}] Processing LaTeX formulas with MathJax...`);
    try {
      const hasFormulas = combinedMarkdown.includes('$');

      if (hasFormulas) {
        console.log(`[${requestId}] Found LaTeX formulas, converting with MathJax...`);

        if (combinedMarkdown.length > 50000) {
          console.log(`[${requestId}] Large document detected, processing in chunks...`);
          const sections = combinedMarkdown.split(/(?=#{1,3}\s)/);
          let processedMarkdown = '';

          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const hasLatex = section.includes('$');
            if (hasLatex) {
              const processedSection = await convertLatexToMathJax(section);
              processedMarkdown += processedSection;
            } else {
              processedMarkdown += section;
            }
          }
          combinedMarkdown = processedMarkdown;
        } else {
          combinedMarkdown = await convertLatexToMathJax(combinedMarkdown);
        }

        console.log(`[${requestId}] LaTeX formulas processed successfully.`);
      } else {
        console.log(`[${requestId}] No LaTeX formulas found, skipping conversion.`);
      }
    } catch (latexError) {
      console.error(`[${requestId}] LaTeX processing error (continuing):`, latexError.message);
    }

    // Step 5: Save markdown
    markdownPath = path.join(requestOutputDir, `${filePrefix}.md`);
    fs.writeFileSync(markdownPath, combinedMarkdown);
    console.log(`[${requestId}] Markdown saved to ${markdownPath}`);

    // Step 6: Generate PDF using local pure-JS conversion (marked + pdfmake)
    if (format.toLowerCase() === 'pdf') {
      pdfPath = path.join(requestOutputDir, `${filePrefix}.pdf`);

      try {
        console.log(`[${requestId}] Generating PDF with marked + pdfmake...`);

        const markdownContent = await fs.promises.readFile(markdownPath, 'utf8');

        // Convert markdown → PDF buffer (pure JS, no microservice, no Puppeteer)
        const pdfBuffer = await convertMarkdownToPdf(markdownContent);

        fs.writeFileSync(pdfPath, pdfBuffer);
        console.log(`[${requestId}] PDF written to ${pdfPath}`);

        // Add watermark using pdf-lib (already pure JS)
        await addWatermarkToPdf(pdfPath);
        console.log(`[${requestId}] Watermark added to PDF`);

        // Upload to Cloudinary
        const uploadResponse = await uploadPDFToCloudinary(
          _userId,
          pdfPath,
          `${filePrefix}.pdf`,
          'pdfGeneration'
        );
        downloadUrl = uploadResponse.secure_url;
        
        if (uploadResponse && uploadResponse.secure_url) {
          await NotesRequestModel.updateOne(
            { _id: requestIdDb },
            {
              secure_url: uploadResponse.secure_url,
              public_id: uploadResponse.public_id,
            }
          );
        } else {
          throw new Error('Failed to upload PDF to Cloudinary');
        }

        console.log(`[${requestId}] PDF uploaded to Cloudinary: ${downloadUrl}`);

        // Update request status in database
        await NotesRequestModel.updateOne(
          { _id: requestIdDb },
          {
            status: 'completed',
            processing_time_ms: Date.now() - startTime,
            output_file: {
              filename: `${filePrefix}.${format.toLowerCase() === 'pdf' ? 'pdf' : 'zip'}`,
              directory: requestIdDb.toString(),
            },
            image_count: imageResults.filter((img) => img.success).length,
            completed_at: new Date(),
          }
        );

        if (note_type === 'detailed') {
          await UserModel.updateOne({ _id: _userId }, { $inc: { 'subscription.credits': -1 } });
        }

        const user = await UserModel.findById(_userId);
        const firstName = user.displayName
          ? user.displayName.split(' ')[0]
          : user.email.split('@')[0];

        const emailResult = await sendNotesReadyEmail({
          userEmail: user.email,
          userName: firstName,
          subjectName: subject_name,
          downloadUrl: downloadUrl,
        });

        if (emailResult.success) {
          console.log(`[${requestId}] Email sent successfully to ${user.email}`);
        }

        // Cleanup local files after upload
        console.log(`[${requestId}] PDF uploaded, cleaning up local files...`);
        await cleanupTempFiles(requestId, requestOutputDir, null, referencePdfPath, vectorStorePath);

      } catch (pdfError) {
        console.error(`[${requestId}] PDF generation error:`, pdfError);
        await cleanupTempFiles(requestId, requestOutputDir, null, referencePdfPath, vectorStorePath);
        throw pdfError;
      }
    } else {
      // Create a ZIP archive for markdown format
      zipPath = await createZipArchive(requestId, requestOutputDir, filePrefix, downloadUrl);
      await cleanupTempFiles(requestId, requestOutputDir, zipPath, referencePdfPath, vectorStorePath);
    }

  } catch (error) {
    console.error(`[${requestId}] Generation process error:`, error);
    await cleanupTempFiles(requestId, requestOutputDir, zipPath, referencePdfPath, vectorStorePath);

    // Update request status in database
    await NotesRequestModel.updateOne(
      { _id: requestIdDb },
      {
        status: 'failed',
        error_message: error.message,
        processing_time_ms: Date.now() - startTime,
      }
    );
  }
}

/**
 * Creates a ZIP archive of the generated content
 */
async function createZipArchive(requestId, sourceDir, filePrefix, downloadUrl) {
  const archiver = (await import('archiver')).default;
  const zipPath = path.join(OUTPUT_DIR, `${filePrefix}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', function () {
      console.log(`[${requestId}] Zip archive created: ${zipPath} (${archive.pointer()} bytes)`);
      resolve(zipPath);
    });

    archive.on('error', function (err) {
      console.error(`[${requestId}] Zip creation error:`, err);
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * Calculate estimated time for generation based on syllabus complexity
 */
function calculateEstimatedTime(
  syllabusLength,
  noteType,
  includeImages,
  educationLevel = 'intermediate'
) {
  let baseTime = 30;
  baseTime += Math.floor(syllabusLength / 500) * 15;
  if (noteType === 'detailed') baseTime *= 1.5;
  if (noteType === 'qa') baseTime *= 1.3;
  if (educationLevel === 'advanced') baseTime *= 1.2;
  if (educationLevel === 'beginner') baseTime *= 0.9;
  if (includeImages === 'yes') baseTime += 45;
  return Math.floor(baseTime);
}

/**
 * Controller for getting status of a note generation request (used for polling)
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export async function getGenerationStatus(req, res) {
  try {
    const { requestId } = req.params;
    const request = await NotesRequestModel.findOne({ requestId });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
      });
    }

    res.json({
      success: true,
      status: request.status,                    // pending | queued | processing | completed | failed
      error: request.error_message || null,
      downloadUrl: request.secure_url || null,   // available when status === 'completed'
      processingTimeMs: request.processing_time_ms || null,
    });
  } catch (error) {
    console.error('Error getting generation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get generation status',
    });
  }
}
