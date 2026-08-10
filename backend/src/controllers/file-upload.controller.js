import path from 'path';
import { uploadPDFToCloudinary } from '../utils/cloudinary-file-upload.util.js';

export const uploadPDFController = async (req, res) => {
    try {
        const userId = req.body.userId;
        const purpose = req.body.purpose;

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const pdfPath = req.file.path;
        const pdfName = path.parse(req.file.originalname).name;

        const response = await uploadPDFToCloudinary(userId, pdfPath, pdfName, purpose);

        if (!response) {
            return res.status(500).json({ error: "Failed to upload PDF to Cloudinary" });
        }

        return res.status(200).json({
            message: "PDF uploaded successfully",
            cloudinaryData: response,
        });

    } catch (error) {
        console.error("Upload Controller Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
