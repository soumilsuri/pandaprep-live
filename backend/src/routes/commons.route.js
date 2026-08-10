import express from 'express';
import multer from 'multer';
import path from 'path';
import { uploadPDFController } from '../controllers/file-upload.controller.js';

const router = express.Router();

// Set up multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // make sure this folder exists
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDFs are allowed'), false);
        }
    },
});

router.post('/upload-pdf', upload.single('pdf'), uploadPDFController);

export default router;
