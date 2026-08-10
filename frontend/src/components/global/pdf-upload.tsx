import React, { useState, useEffect } from "react";
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { BASE_URL } from "@/lib/constant";

type PDFUploadProps = {
  onUploadSuccess: (cloudinaryUrl: string) => void;
  isDarkMode: boolean;
  userId: string | undefined;
  className?: string;
  initialValue?: string;
};

const PDFUpload: React.FC<PDFUploadProps> = ({
  onUploadSuccess,
  isDarkMode,
  userId,
  className = "",
  initialValue = "",
}) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (initialValue) {
      setUploadStatus('success');
      const urlParts = initialValue.split('/');
      let filename = urlParts[urlParts.length - 1] || 'uploaded-file.pdf';
      
      filename = filename.split('?')[0];
      filename = decodeURIComponent(filename);
      
      if (filename.length > 50 || /^[a-f0-9]{10,}/.test(filename)) {
        filename = 'uploaded-reference.pdf';
      }
      
      setUploadedFileName(filename);
    } else {
      setUploadStatus('idle');
      setUploadedFile(null);
      setUploadedFileName("");
    }
  }, [initialValue]);

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setErrorMessage("Only PDF files are allowed");
      setUploadStatus('error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setErrorMessage("File size must be less than 10MB");
      setUploadStatus('error');
      return;
    }

    setUploadedFile(file);
    setUploadedFileName(file.name);
    setErrorMessage("");
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    if (!userId) {
      setErrorMessage("User not authenticated");
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('userId', userId);
    formData.append('purpose', 'referenceMaterial');

    try {
      const response = await fetch(`${BASE_URL}/commons/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.cloudinaryData) {
        setUploadStatus('success');
        onUploadSuccess(result.cloudinaryData.secure_url);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setUploadedFileName("");
    setUploadStatus('idle');
    setErrorMessage("");
    onUploadSuccess("");
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Upload className="w-5 h-5" />;
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading...';
      case 'success':
        return 'Upload successful';
      case 'error':
        return 'Upload failed';
      default:
        return 'Upload PDF';
    }
  };

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {uploadStatus !== 'success' ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? isDarkMode 
                ? 'border-[#D29C7B] bg-[#333230]' 
                : 'border-[#B17457] bg-[#F3EFE5]'
              : isDarkMode
                ? 'border-[#444340] hover:border-[#D29C7B] bg-[#252320]'
                : 'border-gray-300 hover:border-[#B17457] bg-gray-50'
          } ${uploadStatus === 'uploading' ? 'pointer-events-none' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileInputChange}
            className="hidden"
            id="pdf-upload"
            disabled={uploadStatus === 'uploading'}
          />
          <label 
            htmlFor="pdf-upload" 
            className={`cursor-pointer ${uploadStatus === 'uploading' ? 'cursor-not-allowed' : ''}`}
          >
            <div className="flex flex-col items-center space-y-2">
              {getStatusIcon()}
              <p className={`text-sm font-medium ${
                isDarkMode ? 'text-[#D0CCC4]' : 'text-[#4A4947]'
              }`}>
                {getStatusText()}
              </p>
              {uploadStatus === 'idle' && (
                <p className={`text-xs ${
                  isDarkMode ? 'text-[#A9A29A]' : 'text-gray-500'
                }`}>
                  Drag & drop or click to browse (Max 10MB)
                </p>
              )}
            </div>
          </label>
        </div>
      ) : (
        <div className={`border rounded-lg p-4 ${
          isDarkMode 
            ? 'border-[#444340] bg-[#252320]' 
            : 'border-gray-300 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <File className={`w-5 h-5 ${
                isDarkMode ? 'text-[#D29C7B]' : 'text-[#B17457]'
              }`} />
              <div>
                <p className={`text-sm font-medium ${
                  isDarkMode ? 'text-[#D0CCC4]' : 'text-[#4A4947]'
                }`}>
                  {uploadedFileName}
                </p>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="text-xs text-green-500">Uploaded successfully</p>
                </div>
              </div>
            </div>
            <button
              onClick={clearUpload}
              className={`p-1 rounded-full hover:bg-opacity-20 ${
                isDarkMode ? 'hover:bg-[#D29C7B]' : 'hover:bg-[#B17457]'
              }`}
            >
              <X className={`w-4 h-4 ${
                isDarkMode ? 'text-[#A9A29A]' : 'text-gray-500'
              }`} />
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center space-x-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default PDFUpload; 