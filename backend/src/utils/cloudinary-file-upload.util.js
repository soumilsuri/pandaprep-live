import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
import { NotesRequestModel } from '../models/user-request.model.js';
dotenv.config({
  path: './.env',
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a PDF file to Cloudinary and returns the response.
 * @param {string} pdfPath The local path of the PDF file.
 * @param {string} pdfName The name to give the PDF file in Cloudinary.
 * @returns {Object} The response from Cloudinary, or null if the upload fails.
 */
export const uploadPDFToCloudinary = async (_userId, pdfPath, pdfName, purpose) => {
  try {
    console.log('Uploading PDF to Cloudinary...', _userId);
    const userId = _userId.toString();
    if (!pdfPath || !pdfName) {
      console.error('Missing PDF path or name.');
      return null;
    }

    let publicId = '';

    if (purpose === 'pdfGeneration') {
      publicId = `pdfs/pdfGen/${userId}/${pdfName}`;
    } else if (purpose === 'chatWithPDFs') {
      publicId = `pdfs/chat/${userId}/${pdfName}`;
    } else if (purpose === 'referenceMaterial') {
      publicId = `pdfs/refMaterial/${userId}/${pdfName}`;
    } else {
      console.error('Invalid purpose specified.');
      return null;
    }

    // Upload the PDF file to Cloudinary
    const response = await cloudinary.uploader.upload(pdfPath, {
      resource_type: 'raw',
      public_id: publicId, // Store it inside the 'pdfs' folder in Cloudinary
    });

    console.log('Cloudinary Upload Response:', response);

    // Remove the local file after successful upload
    fs.unlinkSync(pdfPath);

    return response;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);

    // Remove the local file if upload fails
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    return null;
  }
};

/**
 * Deletes a PDF file from Cloudinary.
 * @param {string} publicId The public ID of the file in Cloudinary.
 * @returns {Object} The response from Cloudinary, or null if the deletion fails.
 */

export const deletePDFFromCloudinary = async (publicId) => {
  try {
    console.log('Deleting PDF from Cloudinary...', publicId);
    if (!publicId) {
      console.error('Missing public ID.');
      return null;
    }

    // Delete the PDF file from Cloudinary
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
    });

    console.log('Cloudinary Delete Response:', response);
    return response;
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
    return null;
  }
};

/**
 * Deletes PDF files older than 30 days from Cloudinary.
 **/
export const deleteOldPDFsFromCloudinary = async () => {
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let nextCursor = null;

  try {
    do {
      const result = await cloudinary.api.resources({
        type: 'upload',
        resource_type: 'raw',
        prefix: 'pdfs/',
        max_results: 500,
        next_cursor: nextCursor,
      });

      for (const file of result.resources) {
        const createdAt = new Date(file.created_at);
        if (createdAt < THIRTY_DAYS_AGO) {
          console.log(`Deleting old file: ${file.public_id} (Created at: ${createdAt})`);
          await deletePDFFromCloudinary(file.public_id);
        }
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);
  } catch (error) {
    console.error('Error deleting old PDFs from Cloudinary:', error);
  }
};

export const deleteStuckProcessingRequests = async () => {
  const TWELVE_HOURS_AGO = new Date(Date.now() - 12 * 60 * 60 * 1000);

  try {
    const stuckRequests = await NotesRequestModel.find({
      status: 'processing',
      updatedAt: { $lte: TWELVE_HOURS_AGO },
    });

    if (!stuckRequests.length) {
      console.log('No stuck requests older than 12 hours found.');
      return;
    }

    for (const request of stuckRequests) {
      console.log(`Deleting stuck request: ${request._id} (Updated at: ${request.updatedAt})`);
      await NotesRequestModel.deleteOne({ _id: request._id });
    }

    console.log(`${stuckRequests.length} stuck request(s) deleted.`);
  } catch (error) {
    console.error('Error deleting stuck processing requests:', error);
  }
};