"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Send,
  Loader2,
  X,
  Sparkles,
  MessageCircle,
  Eye,
  Zap,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import Navbar from "@/components/global/navbar";
import { toast, Toaster } from "sonner";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import axios from "axios";
import { BASE_URL } from "@/lib/constant";
import { useRouter } from "next/navigation";
import { montserrat500 } from "@/lib/font-utils";
import Image from "next/image"
import ReactMarkdown from 'react-markdown';

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function PDFChatPage() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showPdfViewer, setShowPdfViewer] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatCollapsed, setChatCollapsed] = useState<boolean>(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState<boolean>(false);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const auth = getAuth();

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (user?.photoURL) {
      setUserPhotoUrl(user.photoURL);
    }
  }, [auth.currentUser]);

  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [uploadedFile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth");
      } else {
        setUser(user);
        const token = await user.getIdToken();
        setIdToken(token);
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const loadChatHistory = async () => {
      const params = new URLSearchParams(window.location.search);
      const historyId = params.get('historyId');

      if (historyId && idToken) {
        try {
          const response = await axios.post(
            `${BASE_URL}/chat/reload-pdf`,
            { historyId, email: user?.email || "" },
            {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            }
          );

          if (response.data.success) {
            const { pdfName, messages: historyMessages, vectorStorePath, pdfUrl, documentId } = response.data.data;

            setDocumentId(documentId);
            setPdfName(pdfName);

            // Format chat messages
            const formattedMessages = historyMessages.map((msg: any) => ({
              id: Date.now() + Math.random(),
              role: msg.role,
              content: msg.content,
            }));
            setMessages(formattedMessages);
            setShowPdfViewer(true);
            setPdfUrl(pdfUrl);

            // Download the actual PDF file and create a File object
            const fileResponse = await fetch(pdfUrl);
            const blob = await fileResponse.blob();
            const downloadedFile = new File([blob], pdfName || 'loaded-pdf.pdf', {
              type: 'application/pdf',
            });
            setUploadedFile(downloadedFile); // use your actual state setter for the uploaded file

            toast.success("Chat history loaded successfully");
          }
        } catch (error) {
          console.error("Error loading chat history:", error);
          toast.error("Failed to load chat history");
        }
      }
    };

    if (idToken) {
      loadChatHistory();
    }
  }, [idToken]);


  const handleFileUpload = async (file: File) => {
    if (file.type === "application/pdf") {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please upload a smaller PDF.`);
        return;
      }
      setMessages([]);
      setUploadedFile(file);
      setShowPdfViewer(false);
      setIsProcessingPdf(true); // Start processing state

      try {
        const formData = new FormData();
        const email = user?.email || "";
        formData.append("pdf", file);
        formData.append("userId", email);
        formData.append("purpose", "chatWithPDFs");

        const fileName = file.name;
        const uploadUrl = await axios.post(
          `${BASE_URL}/commons/upload-pdf`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        const pdfUrl = uploadUrl.data.cloudinaryData.secure_url;

        const response = await axios.post(
          `${BASE_URL}/chat/process-pdf`,
          {
            relativeUrl: pdfUrl,
            email: email,
            fileName: fileName,
          },
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        const data = await response.data;

        if (!data.success) {
          throw new Error(data.message || "Failed to process PDF");
        }

        // Set new documentId and clear previous messages
        const newDocumentId = data.data.documentId;
        setDocumentId(newDocumentId);
        setIsProcessingPdf(false); // End processing state

        toast.success("PDF processed successfully");
      } catch (error) {
        console.error("Error uploading PDF:", error);
        toast.error("Failed to process PDF");
        setUploadedFile(null);
        setDocumentId(null);
        setPdfUrl(null);
        setMessages([]);
        setIsProcessingPdf(false); // End processing state on error
      }
    } else {
      toast.error("Please upload a PDF file only");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (files[0].size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please upload a smaller PDF.`);
        return;
      }
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = () => {
    setUploadedFile(null);
    setShowPdfViewer(false);
    setMessages([]);
    setDocumentId(null);
    setPdfUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    if (!documentId || isProcessingPdf) {
      toast.error(isProcessingPdf ? "Please wait for PDF processing to complete" : "Please upload a PDF first");
      return;
    }
    if (!input.trim()) return;

    // Get the auth token
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      toast.error("Please sign in to chat");
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: input,
    };

    // Add user message first
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    setInput("");
    setIsLoading(true);

    // Clean up any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Define assistantMessageId here so it's accessible in catch
    const assistantMessageId = Date.now() + 1;

    try {
      // Make direct fetch call to backend for streaming
      const response = await fetch(`${BASE_URL}/chat/stream-chat-with-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          query: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let fullResponse = "";
      let hasError = false;

      // Add assistant message with streaming content
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          pending: false,
        }
      ]);

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          setIsLoading(false);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                hasError = true;
                throw new Error(data.error);
              }

              if (data.done) {
                setIsLoading(false);
                break;
              }

              if (data.chunk && !hasError) {
                fullResponse += data.chunk;
                // Update the assistant message content
                setMessages((prevMessages) =>
                  prevMessages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: fullResponse }
                      : msg
                  )
                );
              }
            } catch (parseError) {
              console.error("Error parsing chunk:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in chat:", error);
      setIsLoading(false);
      toast.error("Failed to get response");
      // Remove the assistant message on error
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== assistantMessageId)
      );
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  if (!mounted) {
    return null;
  }

 return (
  <div className={`min-h-screen ${montserrat500.className} overflow-hidden flex flex-col ${isDarkMode ? "bg-[#1E1D1B]" : "bg-[#FAF7F0]"}`}>
    <Navbar />
    <Toaster richColors position="top-right" closeButton={true} />

    {/* Coming Soon Banner — FAISS vector store temporarily disabled */}
    <div className={`fixed inset-0 z-40 flex items-center justify-center pointer-events-none`}>
      {/* Blurred overlay */}
      <div className={`absolute inset-0 pointer-events-none ${isDarkMode ? "bg-[#1E1D1B]/60" : "bg-[#FAF7F0]/60"} backdrop-blur-sm`} />

      {/* Coming Soon Card */}
      <div className={`relative z-50 pointer-events-auto max-w-md w-full mx-4 rounded-2xl shadow-2xl border p-8 text-center ${
        isDarkMode
          ? "bg-[#252320] border-[#D29C7B]/30 text-[#D0CCC4]"
          : "bg-white border-[#B17457]/20 text-[#4A4947]"
      }`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isDarkMode ? "bg-[#D29C7B]/20" : "bg-[#B17457]/10"
        }`}>
          <Clock size={32} className={isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"} />
        </div>
        <h2 className={`${montserrat500.className} text-2xl font-bold mb-3`}>
          Coming Soon
        </h2>
        <p className={`text-sm leading-relaxed mb-5 ${
          isDarkMode ? "text-[#A9A29A]" : "text-[#4A4947]/70"
        }`}>
          The <strong>Chat with Notes</strong> feature is temporarily unavailable while we upgrade our infrastructure for better performance.
          <br /><br />
          You can still generate notes from the{" "}
          <a
            href="/generate"
            className={`underline font-semibold ${
              isDarkMode ? "text-[#D29C7B] hover:text-[#b1876c]" : "text-[#B17457] hover:text-[#8f523a]"
            }`}
          >
            Generate Notes
          </a>{" "}
          page.
        </p>
        <a
          href="/generate"
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-colors ${
            isDarkMode
              ? "bg-[#D29C7B] text-[#1E1D1B] hover:bg-[#b1876c]"
              : "bg-[#B17457] text-white hover:bg-[#8f523a]"
          }`}
        >
          <Sparkles size={16} />
          Generate Notes
        </a>
      </div>
    </div>
    <div className="flex-1 container mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-8 mt-24 sm:mt-20 mb-4 sm:mb-12 flex items-start justify-center">
      <div className="max-w-7xl w-full mx-auto">
        {!uploadedFile ? (
          <>
            {/* Persistent Header Section */}
            <div className="text-center mb-4 sm:mb-12 px-2 sm:px-4">
              <div className={`inline-flex items-center gap-1.5 sm:gap-2 ${isDarkMode ? "border-[#D0CCC4] bg-[#D29C7B]/10" : "bg-[#B17457]/10 border-[#B17457]"} backdrop-blur-sm border rounded-full px-2 sm:px-6 py-1.5 sm:py-3 mb-3 sm:mb-6`}>
                <Sparkles className={`h-2.5 sm:h-4 w-2.5 sm:w-4 ${isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"}`} />
                <span className={`${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} text-xs sm:text-sm font-medium`}>AI-Powered PDF Analysis</span>
              </div>
              <h1 className={`text-lg sm:text-4xl md:text-5xl lg:text-6xl font-bold ${isDarkMode
                ? "text-[#B17457]"
                : "text-[#4A4947]"
                } mb-2 sm:mb-6 leading-tight`}>
                Chat with your Notes
              </h1>
              <p className={`text-xs sm:text-lg md:text-xl ${isDarkMode ? "text-[#D0CCC4]/70" : "text-[#4A4947]/70"} max-w-3xl mx-auto leading-relaxed`}>
                Upload your Notes and have intelligent conversations about its content
              </p>
            </div>

            {/* Upload Section with better spacing */}
            <Card
              className={`${isDarkMode
                ? "bg-[#1E1D1B]/80 border-[#D29C7B]/20"
                : "bg-white/90 border-[#B17457]/20"
                } backdrop-blur-xl shadow-2xl max-w-4xl mx-auto`}
            >
              <CardContent className="p-6 sm:p-8 md:p-12">
                <div
                  className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 md:p-16 text-center transition-all duration-300 group cursor-pointer ${isDragOver
                    ? isDarkMode
                      ? "border-[#D29C7B] bg-[#D29C7B]/10 scale-[1.02]"
                      : "border-[#B17457] bg-[#B17457]/10 scale-[1.02]"
                    : isDarkMode
                      ? "border-[#D0CCC4]/20 hover:border-[#D29C7B]/50 hover:bg-[#1E1D1B]/50"
                      : "border-[#4A4947]/20 hover:border-[#B17457]/50 hover:bg-white/50"
                    }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div
                    className={`absolute inset-0 ${isDarkMode
                      ? "bg-gradient-to-r from-[#D29C7B]/10 to-[#D29C7B]/5"
                      : "bg-gradient-to-r from-[#B17457]/10 to-[#B17457]/5"
                      } rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  ></div>

                  <div className="relative z-10">
                    <div
                      className={`w-20 h-20 sm:w-24 sm:h-24 ${isDarkMode
                        ? "bg-gradient-to-r from-[#D29C7B] to-[#D29C7B]/80"
                        : "bg-gradient-to-r from-[#B17457] to-[#B17457]/80"
                        } rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Upload
                        className={`h-10 w-10 sm:h-12 sm:w-12 ${isDarkMode ? "text-[#FAF7F0]" : "text-white"
                          }`}
                      />
                    </div>

                    <h3
                      className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? "text-[#FAF7F0]" : "text-[#4A4947]"
                        } mb-4`}
                    >
                      Drop your PDF here
                    </h3>
                    <p
                      className={`${isDarkMode ? "text-[#D0CCC4]/60" : "text-[#4A4947]/60"}
                        mb-8 text-lg leading-relaxed`}
                    >
                      Or click to browse and select your document
                      <br />
                      <span className="text-xs font-semibold mt-2 block">
                        PDF file size limit: 10MB
                      </span>
                    </p>
                    <Button
                      size="lg"
                      className={`${isDarkMode
                        ? "bg-[#D29C7B] hover:bg-[#D29C7B]/80 text-[#1E1D1B]"
                        : "bg-[#B17457] hover:bg-[#B17457]/80 text-[#FAF7F0]"
                        } border-0 shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-4 text-base font-medium cursor-pointer`}
                    >
                      Choose File
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > MAX_FILE_SIZE_BYTES) {
                          toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please upload a smaller PDF.`);
                          return;
                        }
                        handleFileUpload(file);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Main Application Layout - Mobile responsive grid */
          <div className="space-y-2 sm:space-y-0">
            {/* Compact Header for Mobile */}
            <div className="text-center py-2 sm:py-4 lg:hidden">
              <h1 className={`text-base sm:text-2xl font-bold ${isDarkMode ? "text-[#B17457]" : "text-[#4A4947]"}`}>
                Chat with your Notes
              </h1>
            </div>

            {/* Mobile View Controls */}
            <div className="flex items-center justify-center lg:hidden px-2 sm:px-4 w-full">
              <div className={`w-full max-w-sm rounded-lg sm:rounded-2xl p-0.5 sm:p-1.5 ${isDarkMode
                ? "bg-[#2A2826] ring-1 ring-[#D29C7B]/20"
                : "bg-white/95 ring-1 ring-[#B17457]/20"} shadow-lg backdrop-blur-sm`}>
                <div className={`flex w-full rounded-md sm:rounded-xl overflow-hidden ${isDarkMode
                  ? "bg-[#1E1D1B]"
                  : "bg-[#F5F5F5]"}`}>
                  <Button
                    variant="ghost"
                    onClick={() => setShowPdfViewer(false)}
                    className={`flex-1 h-8 sm:h-12 ${!showPdfViewer
                      ? isDarkMode
                        ? "bg-[#D29C7B] text-[#1E1D1B] hover:bg-[#D29C7B] hover:text-[#1E1D1B]"
                        : "bg-[#B17457] text-white hover:bg-[#B17457] hover:text-white"
                      : isDarkMode
                        ? "text-[#D29C7B]/70 hover:text-[#D29C7B] hover:bg-transparent"
                        : "text-[#B17457]/70 hover:text-[#B17457] hover:bg-transparent"
                      } transition-all duration-200`}
                  >
                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                      <MessageCircle className="h-3 w-3 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-base font-medium">Chat</span>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowPdfViewer(true)}
                    className={`flex-1 h-8 sm:h-12 ${showPdfViewer
                      ? isDarkMode
                        ? "bg-[#D29C7B] text-[#1E1D1B] hover:bg-[#D29C7B] hover:text-[#1E1D1B]"
                        : "bg-[#B17457] text-white hover:bg-[#B17457] hover:text-white"
                      : isDarkMode
                        ? "text-[#D29C7B]/70 hover:text-[#D29C7B] hover:bg-transparent"
                        : "text-[#B17457]/70 hover:text-[#B17457] hover:bg-transparent"
                      } transition-all duration-200`}
                  >
                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                      <Eye className="h-3 w-3 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-base font-medium">View PDF</span>
                    </div>
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-2 lg:gap-6 h-[calc(100vh-12rem)] sm:h-[calc(100vh-16rem)] lg:h-[calc(100vh-12rem)] overflow-hidden">
              {/* PDF Section */}
              <div className={`${!showPdfViewer ? 'hidden lg:block' : 'block'} w-full h-full overflow-hidden`}>
                <div className="flex flex-col h-full gap-2">
                  {/* File Info Card */}
                  <Card className="shrink-0">
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 ${isDarkMode
                            ? "bg-gradient-to-r from-[#D29C7B] to-[#D29C7B]/80"
                            : "bg-gradient-to-r from-[#B17457] to-[#B17457]/80"
                            } rounded-lg flex items-center justify-center`}>
                            <FileText className={`h-4 w-4 ${isDarkMode ? "text-[#FAF7F0]" : "text-white"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className={`font-medium text-sm truncate ${isDarkMode ? "text-[#FAF7F0]" : "text-[#4A4947]"}`}>
                              {uploadedFile.name}
                            </h3>
                            <p className={`text-xs ${isDarkMode ? "text-[#D0CCC4]/60" : "text-[#4A4947]/60"}`}>
                              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for analysis
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={removeFile}
                          className={`h-7 w-7 p-0 ${isDarkMode
                            ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            : "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            }`}
                        >
                          <X className="h-4 w-4 cursor-pointer" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* PDF Viewer */}
                  <Card className="flex-1 overflow-hidden">
                    <CardContent className="p-0 h-full">
                      {/* Processing Overlay */}
                      {isProcessingPdf && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <div className="text-center">
                            <Loader2 className={`h-12 w-12 animate-spin mx-auto mb-4 ${isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"}`} />
                            <p className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-white"}`}>
                              Processing PDF...
                            </p>
                            <p className={`text-sm ${isDarkMode ? "text-white/70" : "text-white/70"}`}>
                              This may take a few moments
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="h-full">
                        {pdfUrl && (
                          <object
                            data={pdfUrl}
                            type="application/pdf"
                            className="w-full h-full"
                          >
                            <div className={`flex items-center justify-center h-full ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}>
                              <div className="text-center p-8">
                                <FileText className={`h-16 w-16 mx-auto mb-4 ${isDarkMode ? "text-[#D29C7B]/50" : "text-[#B17457]/50"}`} />
                                <p className="text-lg mb-4">PDF cannot be displayed in this browser.</p>
                                <Button
                                  onClick={() => window.open(pdfUrl, '_blank')}
                                  className={`${isDarkMode
                                    ? "bg-[#D29C7B] hover:bg-[#D29C7B]/80 text-[#1E1D1B]"
                                    : "bg-[#B17457] hover:bg-[#B17457]/80 text-[#FAF7F0]"
                                    }`}
                                >
                                  Open PDF in New Tab
                                </Button>
                              </div>
                            </div>
                          </object>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Chat Section */}
              <div className={`${showPdfViewer ? 'hidden lg:block' : 'block'} w-full h-full overflow-hidden`}>
                <Card className="h-full">
                  <CardContent className="p-3 lg:p-4 h-full flex flex-col">
                    {/* Chat Header */}
                    <div className="shrink-0 flex items-center gap-2 mb-3">
                      <div className={`w-7 h-7 ${isDarkMode
                        ? "bg-gradient-to-r from-[#D29C7B] to-[#D29C7B]/80"
                        : "bg-gradient-to-r from-[#B17457] to-[#B17457]/80"
                        } rounded-lg flex items-center justify-center`}>
                        <MessageCircle className={`h-4 w-4 ${isDarkMode ? "text-[#FAF7F0]" : "text-white"}`} />
                      </div>
                      <h2 className={`text-base font-semibold ${isDarkMode ? "text-[#FAF7F0]" : "text-[#4A4947]"}`}>
                        AI Assistant
                      </h2>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="space-y-3 pr-3">
                          {messages.length === 0 ? (
                            <div className="text-center py-8">
                              <div className={`w-20 h-20 ${isDarkMode
                                ? "bg-gradient-to-r from-[#D29C7B]/20 to-[#D29C7B]/10"
                                : "bg-gradient-to-r from-[#B17457]/20 to-[#B17457]/10"
                                } rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                                <Sparkles className={`h-10 w-10 ${isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"}`} />
                              </div>
                              <h3 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? "text-[#B17457]" : "text-[#4A4947]"} mb-4`}>
                                Start Analyzing Your Notes
                              </h3>
                              <p className={`${isDarkMode ? "text-[#D0CCC4]/60" : "text-[#4A4947]/60"} mb-6 text-sm leading-relaxed`}>
                                Ask me anything about your document. Here are some suggestions:
                              </p>
                              <div className="flex flex-wrap justify-center gap-2">
                                {["Summarize this document", "What are the key points?", "Explain the main concepts"].map((suggestion) => (
                                  <Badge
                                    key={suggestion}
                                    variant="outline"
                                    className={`${isDarkMode
                                      ? "border-[#D29C7B]/20 text-[#D0CCC4] hover:bg-[#D29C7B]/10"
                                      : "border-[#B17457]/20 text-[#4A4947] hover:bg-[#B17457]/10"
                                      } cursor-pointer transition-colors duration-200 py-2 px-3`}
                                    onClick={() => setInput(suggestion)}
                                  >
                                    {suggestion}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : (
                            messages.map((message) => (
                              <div
                                key={message.id}
                                className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                              >
                                {message.role === "assistant" && (
                                  <div className={`w-10 h-10 ${isDarkMode
                                    ? "bg-gradient-to-r from-[#D29C7B] to-[#D29C7B]/80"
                                    : "bg-gradient-to-r from-[#B17457] to-[#B17457]/80"
                                    } rounded-full flex items-center justify-center flex-shrink-0 mt-1`}>
                                    <Sparkles className={`h-5 w-5 ${isDarkMode ? "text-[#FAF7F0]" : "text-white"}`} />
                                  </div>
                                )}
                                <div
                                  className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-lg overflow-x-auto break-all ${message.role === "user"
                                    ? isDarkMode
                                      ? "bg-gradient-to-r from-[#D29C7B] to-[#D29C7B]/80 text-[#1E1D1B]"
                                      : "bg-gradient-to-r from-[#B17457] to-[#B17457]/80 text-[#FAF7F0]"
                                    : isDarkMode
                                      ? "bg-[#1E1D1B]/60 backdrop-blur-sm text-[#FAF7F0] border border-[#D29C7B]/20"
                                      : "bg-white/60 backdrop-blur-sm text-[#4A4947] border border-[#B17457]/20"
                                    }`}
                                >

                                  {message.role === "assistant" ? (
                                    <div className={`prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-sm ${isDarkMode ? "prose-invert" : ""}`}>
                                      <ReactMarkdown
                                        components={{
                                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                                          li: ({ children }) => <li className="mb-1">{children}</li>,

                                          code: ({ children }) => (
                                            <code className={`px-1 py-0.5 rounded text-xs ${isDarkMode
                                                ? "bg-[#D29C7B]/20 text-[#D29C7B]"
                                                : "bg-[#B17457]/20 text-[#B17457]"
                                              }`}>
                                              {children}
                                            </code>
                                          ),
                                          pre: ({ children }) => (
                                            <pre className={`p-3 rounded-lg overflow-x-auto text-xs ${isDarkMode
                                                ? "bg-[#1E1D1B] border border-[#D29C7B]/30"
                                                : "bg-[#F5F5F5] border border-[#B17457]/30"
                                              }`}>
                                              {children}
                                            </pre>
                                          ),
                                        }}
                                      >
                                        {message.content}
                                      </ReactMarkdown>
                                    </div>
                                  )
                                    : (
                                      <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
                                    )}
                                </div>
                                {message.role === "user" && (
                                  <div className={`w-10 h-10 ${isDarkMode
                                    ? "bg-gradient-to-r from-[#D29C7B]/80 to-[#D29C7B] ring-1 ring-[#D29C7B]"
                                    : "bg-gradient-to-r from-[#B17457]/80 to-[#B17457] ring-1 ring-[#B17457]"
                                    } rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden`}>
                                    {userPhotoUrl ? (
                                      <Image
                                        src={userPhotoUrl}
                                        alt="User"
                                        width={40}
                                        height={40}
                                        className="object-cover"
                                      />
                                    ) : (
                                      <span className={`${isDarkMode ? "text-[#1E1D1B]" : "text-white"} text-sm font-semibold`}>U</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )))}
                          {isLoading && (
                            <div className="flex gap-4 justify-start">
                              <div className={`w-10 h-10 ${isDarkMode
                                ? "bg-gradient-to-r from-[#D29C7B] to-[#D29C7B]/80"
                                : "bg-gradient-to-r from-[#B17457] to-[#B17457]/80"
                                } rounded-full flex items-center justify-center flex-shrink-0`}>
                                <Sparkles className={`h-5 w-5 ${isDarkMode ? "text-[#FAF7F0]" : "text-white"}`} />
                              </div>
                              <div className={`${isDarkMode
                                ? "bg-[#1E1D1B]/60 border-[#D29C7B]/20"
                                : "bg-white/60 border-[#B17457]/20"
                                } backdrop-blur-sm rounded-2xl px-5 py-4 border`}>
                                <div className="flex items-center gap-3">
                                  <Loader2 className={`h-4 w-4 animate-spin ${isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"}`} />
                                  <span className={`${isDarkMode ? "text-[#D0CCC4]/70" : "text-[#4A4947]/70"} text-sm`}>Analyzing your document...</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Input Area */}
                    <div className="shrink-0 relative mt-3">
                      <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder={isProcessingPdf ? "Processing PDF..." : "Ask me anything about your PDF..."}
                        disabled={isLoading || isProcessingPdf}
                        className={`pr-10 h-9 text-sm ${isDarkMode
                          ? "bg-[#1E1D1B]/60 border-[#D29C7B]/20 text-[#FAF7F0] placeholder:text-[#D0CCC4]/50"
                          : "bg-white/60 border-[#B17457]/20 text-[#4A4947] placeholder:text-[#4A4947]/50"
                          } backdrop-blur-sm rounded-lg ${(isLoading || isProcessingPdf) ? 'opacity-50' : ''}`}
                        onKeyPress={handleKeyPress}
                      />
                      <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !input.trim() || isProcessingPdf}
                        size="sm"
                        className={`absolute right-1.5 top-1 h-7 w-7 p-0 ${isDarkMode
                          ? "bg-gradient-to-r from-[#D29C7B] to-[#D29C7B]/80"
                          : "bg-gradient-to-r from-[#B17457] to-[#B17457]/80"
                          } rounded-lg ${(isLoading || isProcessingPdf) ? 'opacity-50' : ''}`}
                      >
                        {isLoading || isProcessingPdf ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5 cursor-pointer" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
