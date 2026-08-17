"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import app from "@/firebase/firebaseconfig";
import { Funnel_Display } from "next/font/google";
import Navbar from "@/components/global/navbar";
import MultiTabSwitch from "@/components/ui/option-switch";
import axios from "axios";
import { BASE_URL, AGENTIC_BASE_URL } from "@/lib/constant";
import PDFLikeMarkdownDisplay from "@/components/global/PDFdisplay";
import { useTheme } from "next-themes";
import { montserrat400, montserrat500, montserrat600 } from "@/lib/font-utils";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookText,
  ChartLine,
  CheckCircle,
  FileText,
  Lightbulb,
  Settings,
  Sparkles,
  AlertCircle,
  Download,
  Redo,
  Loader2,
  Lock,
  Clock,
} from "lucide-react";

import AnimatedInput from "@/components/global/input";
import { Switch } from "@/components/ui/switch";
import PDFUpload from "@/components/global/pdf-upload";

const NotesGenerate = () => {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const auth = getAuth(app);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState("");
  const [requestId, setRequestId] = useState("");
  const [generationComplete, setGenerationComplete] = useState(false);
  const [markdownContent, setMarkdownContent] = useState("");
  const [downloadId, setDownloadId] = useState("");
  const [error, setError] = useState("");

  const [showGenerateButton, setShowGenerateButton] = useState(true);
  const [userCredits, setUserCredits] = useState(0);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string | boolean;
  }>({});
  const [stepsCompleted, setStepsCompleted] = useState<{
    [key: number]: boolean;
  }>({
    0: false,
    1: false,
    2: false,
  });
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isInQueue, setIsInQueue] = useState(false);

  // Polling interval ref
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user?.email) {
      setFormData((prev) => ({ ...prev, email: user.email }));
    }
  }, [user]);

  useEffect(() => {
    if (idToken) {
      handleGetUser();
    }
  }, [idToken]);

  const [formData, setFormData] = useState({
    email: user?.email,
    syllabus: "",
    subject_name: "",
    user_instructions: "",
    note_type: "concise",
    education_level: "beginner",
    include_examples: "yes",
    include_images: "no",
    relativePathToReferenceMaterial: "",
  });

  useEffect(() => {
    validateSteps();
  }, [formData]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const validateSteps = () => {
    const step1Valid = !!formData.subject_name.trim();

    const syllabusLength = formData.syllabus.trim().length;
    const syllabusValid = syllabusLength >= 10 && syllabusLength <= 2500;

    const instructionsLength = formData.user_instructions.trim().length;
    const instructionsValid =
      instructionsLength === 0 ||
      (instructionsLength >= 10 && instructionsLength <= 500);

    const step2Valid = syllabusValid && instructionsValid;

    const step3Valid = true;

    setStepsCompleted({
      0: step1Valid,
      1: step2Valid,
      2: step3Valid,
    });
  };

  const getCharacterCount = (fieldKey: string) => {
    return formData[fieldKey as keyof typeof formData]?.toString().length || 0;
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === "syllabus" && value.length > 2500) {
      value = value.slice(0, 2500);
    } else if (field === "user_instructions" && value.length > 500) {
      value = value.slice(0, 500);
    }

    setFormData((prev) => ({ ...prev, [field]: value }));

    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleGetUser = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/get`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      setUserCredits(res.data.subscription.credits);
    } catch (error: any) {
      console.error("Error fetching user data:", error);
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string | boolean } = {};

    if (!formData.subject_name.trim()) {
      errors.subject_name = true;
    }

    if (!formData.syllabus.trim()) {
      errors.syllabus = "Syllabus is required";
    } else if (formData.syllabus.length < 10) {
      errors.syllabus = `Syllabus must be at least 10 characters (currently ${formData.syllabus.length})`;
    } else if (formData.syllabus.length > 2500) {
      errors.syllabus = `Syllabus must be less than 2500 characters (currently ${formData.syllabus.length})`;
    }

    if (formData.user_instructions.trim().length > 0) {
      if (formData.user_instructions.length < 10) {
        errors.user_instructions = `Instructions must be at least 10 characters (currently ${formData.user_instructions.length})`;
      } else if (formData.user_instructions.length > 500) {
        errors.user_instructions = `Instructions must be less than 500 characters (currently ${formData.user_instructions.length})`;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Starts polling the /generation-status endpoint every 4 seconds.
   */
  const startPolling = (reqId: string, token: string) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setCurrentStage("initializing");
    setIsInQueue(false);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(
          `${AGENTIC_BASE_URL}/pipeline/generation-status/${reqId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const { status, markdown, downloadUrl, error: jobError } = res.data;

        // Update stage message based on DB status
        if (status === "queued") {
          setCurrentStage("queued");
          setIsInQueue(false);
        } else if (status === "processing") {
          setCurrentStage("processing");
          setIsInQueue(false);
        } else if (status === "completed") {
          // Stop polling — we're done!
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setCurrentStage("generation_complete");
          setGenerationComplete(true);
          setIsGenerating(false);
          setShowGenerateButton(true);
          setHasAttemptedGeneration(true);
          setIsInQueue(false);
          if (markdown) {
            setMarkdownContent(markdown);
          }
          if (downloadUrl) {
            setDownloadId(downloadUrl);
          }
        } else if (status === "failed") {
          // Stop polling — job failed
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError(jobError || "Notes generation failed. Please try again.");
          setIsGenerating(false);
          setShowGenerateButton(true);
          setIsInQueue(false);
        }
      } catch (err) {
        console.error("Polling error:", err);
        // Don't stop polling on transient errors — keep retrying
      }
    }, 4000); // Poll every 4 seconds
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) {
        setError("Please fill in all required fields correctly.");
        return;
      }
      setCurrentStep(3);
      setIsGenerating(true);
      setShowGenerateButton(false);
      setError("");
      setCurrentStage("initializing");
      setGenerationComplete(false);
      setMarkdownContent("");
      setDownloadId("");
      setEstimatedTime(0);
      setIsInQueue(false);

      const payload = {
        ...formData,
        email: user?.email || formData.email || "",
        format: "markdown",
      };

      const response = await axios.post(
        `${AGENTIC_BASE_URL}/pipeline/generate-notes`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (response.data.success) {
        const reqId = response.data.requestId;
        setRequestId(reqId);
        if (response.data.estimatedTimeSeconds) {
          setEstimatedTime(response.data.estimatedTimeSeconds);
        }
        startPolling(reqId, idToken!);
      }
    } catch (error) {
      console.error("Error generating notes:", error);
      if (error) {
        if (axios.isAxiosError(error) && error.response) {
          setError(
            error.response.data.error ||
              error.response.data.message ||
              "Server error occurred"
          );
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } else {
        setError(
          "Error generating notes. Please check your connection and try again."
        );
      }
      setIsGenerating(false);
      setShowGenerateButton(true);
    }
  };

  const downloadGeneratedNotes = () => {
    if (!markdownContent && !downloadId) {
      setError("No notes available to download. Please generate notes first.");
      return;
    }

    if (downloadId && !markdownContent) {
      window.open(downloadId, "_blank");
      return;
    }

    // Find the rendered HTML content
    const printableElement = document.getElementById("printable-notes-section");
    if (!printableElement) {
      window.print();
      return;
    }

    // Create an isolated hidden iframe for clean, full-document printing
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${formData.subject_name ? `${formData.subject_name} Notes` : "PandaPrep Study Notes"}</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
          <style>
            @page {
              size: A4;
              margin: 18mm 15mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.65;
              color: #111827;
              background: #ffffff;
              margin: 0;
              padding: 0;
            }
            h1 {
              font-size: 24px;
              font-weight: 700;
              margin-top: 0;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e5e7eb;
              page-break-after: avoid;
              break-after: avoid;
            }
            h2 {
              font-size: 18px;
              font-weight: 600;
              margin-top: 22px;
              margin-bottom: 10px;
              padding-bottom: 4px;
              border-bottom: 1px solid #e5e7eb;
              page-break-after: avoid;
              break-after: avoid;
            }
            h3 {
              font-size: 15px;
              font-weight: 600;
              margin-top: 18px;
              margin-bottom: 8px;
              page-break-after: avoid;
              break-after: avoid;
            }
            p {
              margin: 8px 0;
              text-align: justify;
            }
            ul, ol {
              margin: 8px 0;
              padding-left: 24px;
            }
            li {
              margin: 4px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
              page-break-inside: avoid;
              break-inside: avoid;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f3f4f6;
              font-weight: 600;
            }
            pre {
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 12px;
              overflow-x: auto;
              font-family: monospace;
              font-size: 12px;
              margin: 12px 0;
              page-break-inside: avoid;
              break-inside: avoid;
              white-space: pre-wrap;
            }
            code {
              font-family: monospace;
              background: #f3f4f6;
              padding: 2px 4px;
              border-radius: 4px;
              font-size: 12px;
            }
            pre code {
              padding: 0;
              background: transparent;
            }
            blockquote {
              border-left: 4px solid #b17457;
              background: #faf7f0;
              padding: 8px 16px;
              margin: 12px 0;
              font-style: italic;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            hr {
              border: none;
              border-top: 1px solid #e5e7eb;
              margin: 20px 0;
            }
            a {
              color: #b17457;
              text-decoration: none;
            }
            .no-print {
              display: none !important;
            }
            .katex-display {
              margin: 12px 0;
              overflow-x: auto;
              overflow-y: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
            }
          </style>
        </head>
        <body>
          ${printableElement.innerHTML}
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 2000);
    }, 300);
  };



  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/auth");
      } else {
        setUser(user);
      }
    });

    return () => {
      unsubscribe();
      // Cleanup polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [auth, router]);

  const renderGenerationStatus = () => {
    if (!isGenerating && !generationComplete) return null;

    let statusMessage = "";
    let statusColor = isDarkMode
      ? "border-green-900"
      : "bg-green-50 border-green-200";
    let statusTextColor = isDarkMode ? "text-white" : "text-green-700";

    if (error) {
      statusColor = isDarkMode ? "border-red-900" : "bg-red-50 border-red-200";
      statusTextColor = isDarkMode ? "text-white" : "text-red-700";
      statusMessage = error;
    } else {
      switch (currentStage) {
        case "initializing":
          statusMessage = "Initializing generation process...";
          break;
        case "queued":
          statusMessage = "Request queued for processing...";
          break;
        case "processing":
          statusMessage = "Generating your notes...";
          break;
        case "generation_complete":
          statusMessage = "Notes successfully generated!";
          break;
        default:
          statusMessage = `Processing: ${currentStage.replace(/_/g, " ")}`;
      }
    }

    return (
      <div
        className={`p-2 sm:p-3 ${statusColor} border rounded-md flex items-center gap-2 sm:gap-3`}
      >
        {isGenerating && (
          <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" />
        )}
        <p className={`${statusTextColor} text-sm sm:text-base`}>
          {statusMessage}
        </p>
      </div>
    );
  };

  const steps = ["Subject", "Content", "Format", "Result"];
  const stepIcons = [
    <BookText key="book-text-icon" size={20} />,
    <FileText key="file-text-icon" size={20} />,
    <Settings key="settings-icon" size={20} />,
    <BookOpen key="book-open-icon" size={20} />,
  ];

  const placeholders = [
    "Enter subject...",
    "E.g., Database Systems",
    "E.g., Data Structures",
    "E.g., Computer Networks",
  ];

  const [currentStep, setCurrentStep] = useState(0);

  const progressPercent = (currentStep / (steps.length - 1)) * 100;

  const handleStepClick = (index: number) => {
    if (index === 3 && !hasAttemptedGeneration) {
      return;
    }
    setCurrentStep(index);
  };

  const [showTooltip, setShowTooltip] = useState(false);
  const [showOtherTooltip, setShowOtherTooltip] = useState(false);
  const [showContextTooltip, setShowContextTooltip] = useState(false);

  const toggleTooltip = () => {
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 3000);
  };
  const toggleOtherTooltip = () => {
    setShowOtherTooltip((prev) => !prev);
    setTimeout(() => setShowOtherTooltip(false), 3000);
  };

  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const step1Component = () => {
    return (
      <div
        className={`px-2 sm:px-4 pt-1 ${
          isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
        } transition-colors duration-300`}
      >
        <div className="pb-3 sm:pb-5">
          <div
            className={`${montserrat500.className} text-2xl sm:text-4xl flex gap-2`}
          >
            <BookText
              size={24}
              className={`text-[#B17457] mb-2 sm:w-10 sm:h-10 ${
                isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
              }`}
            />
            <p>Enter Your Subject</p>
          </div>

          <p
            className={`${montserrat400.className} text-sm sm:text-lg ${
              isDarkMode ? "text-[#A9A29A]" : ""
            }`}
          >
            Let&apos;s start by defining what you want to learn about
          </p>
        </div>
        <div className="w-full space-y-2">
          <p
            className={`${montserrat500.className} text-2xl ${
              validationErrors.subject_name ? "text-red-500" : ""
            }`}
          >
            Subject Name{" "}
          </p>
          <div className="relative">
            <AnimatedInput
              textarea={false}
              formDataValue={formData.subject_name}
              handleInputChange={handleInputChange}
              fieldKey="subject_name"
              placeholders={placeholders}
              className={`${
                validationErrors.subject_name ? "border-red-500" : ""
              } ${
                isDarkMode ? "bg-[#333230] border-[#444340] text-[#D0CCC4]" : ""
              }`}
            />
            {validationErrors.subject_name && (
              <p className="text-red-500 text-sm mt-1">
                Subject name is required
              </p>
            )}
          </div>
        </div>

        <div className="w-full py-5 flex flex-col gap-1">
          <p className={`${montserrat500.className} py-2 text-2xl`}>
            Education Level
          </p>
          <MultiTabSwitch
            tabs={[
              { label: "Beginner", value: "beginner" },
              { label: "Intermediate", value: "intermediate" },
              { label: "Advanced", value: "advanced" },
            ]}
            lgSize
            handleChange={handleInputChange}
            field="education_level"
            userCredits={userCredits}
            value={formData.education_level}
          />
        </div>
        <div
          className={`mt-4 ${
            isDarkMode
              ? "bg-[#252320] border-[#D29C7B]"
              : "bg-[#F3EFE5] border-[#B17457]"
          } p-3 rounded-xl border-4 transition-colors duration-300`}
        >
          <div
            className={`${
              isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
            } flex gap-1 sm:gap-2 items-center`}
          >
            <Lightbulb
              size={20}
              className={`sm:w-8 sm:h-8 ${isDarkMode ? "text-[#D29C7B]" : ""}`}
            />
            <p className={`${montserrat500.className} text-lg sm:text-2xl`}>
              Tip
            </p>
          </div>
          <p
            className={`${montserrat400.className} text-[12px] sm:text-lg ${
              isDarkMode ? "text-[#A9A29A]" : ""
            }`}
          >
            Be specific with your subject to get more targeted notes. For
            example, &quot;Introduction to Neural Networks&quot; is better than
            just &quot;Machine Learning&quot;.
          </p>
        </div>
      </div>
    );
  };

  const step2Component = () => {
    return (
      <div
        className={`px-2 sm:px-4 pt-1 ${
          isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
        } transition-colors duration-300`}
      >
        <div className="pb-3 sm:pb-5">
          <div
            className={`${montserrat500.className} text-2xl sm:text-4xl flex gap-2 items-center`}
          >
            <FileText
              size={24}
              className={`mb-1 sm:w-10 sm:h-10 ${
                isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
              }`}
            />
            <p>Content Details</p>
          </div>

          <p
            className={`${montserrat400.className} text-sm sm:text-lg ${
              isDarkMode ? "text-[#A9A29A]" : ""
            }`}
          >
            Provide more information about what you want to learn
          </p>
        </div>

        <div className="w-full space-y-4">
          <div className="flex justify-between items-center">
            <p
              className={`${montserrat500.className} text-2xl ${
                typeof validationErrors.syllabus === "string"
                  ? "text-red-500"
                  : ""
              }`}
            >
              Syllabus or Topic Outline{" "}
            </p>
            <span
              className={`text-sm ${
                getCharacterCount("syllabus") > 2500
                  ? "text-red-500"
                  : isDarkMode
                  ? "text-[#A9A29A]"
                  : "text-gray-500"
              }`}
            >
              {getCharacterCount("syllabus")}/2500
            </span>
          </div>

          <div className="relative">
            <AnimatedInput
              textarea={true}
              formDataValue={formData.syllabus}
              handleInputChange={handleInputChange}
              fieldKey="syllabus"
              placeholders={[
                "Enter your syllabus...",
                "E.g., Basic concepts: database & database users...",
                "E.g., The basic human aspirations...",
              ]}
              className={`min-h-[100px] sm:min-h-[130px] ${
                validationErrors.syllabus ? "border-red-500" : ""
              } ${
                isDarkMode ? "bg-[#333230] border-[#444340] text-[#D0CCC4]" : ""
              }`}
            />
            {typeof validationErrors.syllabus === "string" && (
              <p className="text-red-500 text-sm mt-1">
                {validationErrors.syllabus}
              </p>
            )}
            {!validationErrors.syllabus && (
              <p
                className={`${montserrat400.className} text-sm sm:text-base ${
                  isDarkMode ? "text-[#A9A29A]" : "text-[#4A4947]"
                } mt-1`}
              >
                List the main topics you want to be covered in your notes
                (10-2500 characters)
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p
                  className={`${montserrat500.className} text-xl sm:text-2xl ${
                    typeof validationErrors.user_instructions === "string"
                      ? "text-red-500"
                      : ""
                  }`}
                >
                  User Instructions (Optional)
                </p>
                <span
                  className={`text-sm ${
                    getCharacterCount("user_instructions") > 500
                      ? "text-red-500"
                      : isDarkMode
                      ? "text-[#A9A29A]"
                      : "text-gray-500"
                  }`}
                >
                  {getCharacterCount("user_instructions")}/500
                </span>
              </div>
              <div className="relative">
                <AnimatedInput
                  textarea={true}
                  formDataValue={formData.user_instructions}
                  handleInputChange={handleInputChange}
                  fieldKey="user_instructions"
                  placeholders={[
                    "Enter your instructions...",
                    "E.g., Elaborate more on ER diagrams",
                    "E.g., Go in depth on the topic of Normalization",
                  ]}
                  className={`min-h-[80px] sm:min-h-[120px] ${
                    validationErrors.user_instructions ? "border-red-500" : ""
                  } ${
                    isDarkMode
                      ? "bg-[#333230] border-[#444340] text-[#D0CCC4]"
                      : ""
                  }`}
                />
                {typeof validationErrors.user_instructions === "string" && (
                  <p className="text-red-500 text-sm mt-1">
                    {validationErrors.user_instructions}
                  </p>
                )}
                {!validationErrors.user_instructions && (
                  <p
                    className={`${
                      montserrat400.className
                    } text-sm sm:text-base ${
                      isDarkMode ? "text-[#A9A29A]" : "text-[#4A4947]"
                    } mt-1`}
                  >
                    Any specific requirements or focus areas for your notes (if
                    provided, 10-500 characters)
                  </p>
                )}
              </div>
            </div>

            {/* Add Context — PDF Upload */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className={`${montserrat500.className} text-xl sm:text-2xl`}>
                  Add Context (Optional)
                </p>
              </div>
              <PDFUpload
                onUploadSuccess={(url) =>
                  setFormData((prev) => ({
                    ...prev,
                    relativePathToReferenceMaterial: url,
                  }))
                }
                isDarkMode={isDarkMode}
                userId={user?.uid}
                initialValue={formData.relativePathToReferenceMaterial}
              />
              <p
                className={`${montserrat400.className} text-sm sm:text-base ${
                  isDarkMode ? "text-[#A9A29A]" : "text-[#4A4947]"
                }`}
              >
                Upload reference material (PDF) to provide additional context
                for your notes
              </p>
            </div>
          </div>

          <div
            className={`mt-8 mb-8 ${
              isDarkMode
                ? "bg-[#252320] border-[#D29C7B]"
                : "bg-[#F3EFE5] border-[#B17457]"
            } p-3 rounded-xl border-4 transition-colors duration-300`}
          >
            <div
              className={`${
                isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
              } flex gap-1 sm:gap-2 items-center`}
            >
              <Lightbulb
                size={20}
                className={`sm:w-8 sm:h-8 ${
                  isDarkMode ? "text-[#D29C7B]" : ""
                }`}
              />
              <p className={`${montserrat500.className} text-lg sm:text-2xl`}>
                Tip
              </p>
            </div>
            <p
              className={`${montserrat400.className} text-[12px] sm:text-lg ${
                isDarkMode ? "text-[#A9A29A]" : ""
              }`}
            >
              If your syllabus is lengthy or split into several units, try
              generating one unit at a time.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const step3Component = () => {
    return (
      <div
        className={`px-2 sm:px-4 pt-1 ${
          isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
        } transition-colors duration-300`}
      >
        <div className="pb-3 sm:pb-5">
          <div
            className={`${montserrat500.className} text-2xl sm:text-4xl flex gap-2 items-center`}
          >
            <Settings
              size={24}
              className={`mb-1 sm:w-10 sm:h-10 ${
                isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
              }`}
            />
            <p>Format Options</p>
          </div>
          <p
            className={`${montserrat400.className} text-sm sm:text-lg ${
              isDarkMode ? "text-[#A9A29A]" : ""
            }`}
          >
            Customize how your notes will be presented
          </p>
        </div>

        <p className={`${montserrat500.className} text-2xl pt-3 pb-4`}>
          Note Format
        </p>

        <div className="w-full space-y-4 pb-8">
          <div
            className={`${
              isDarkMode ? "bg-[#333230]" : "bg-[#D9D9D9]"
            } rounded-xl p-1.5 flex justify-between items-center transition-colors duration-300`}
          >
            {["concise", "qa", "detailed"].map((type) => {
              const isDisabled = type === "detailed" && userCredits <= 0;
              const isSelected = formData.note_type === type;

              return (
                <button
                  key={type}
                  onClick={() => {
                    if (isDisabled) return;
                    setFormData((prev) => ({ ...prev, note_type: type }));
                  }}
                  className={`w-1/3 text-sm sm:text-lg font-medium py-1 sm:py-2 rounded-lg ${
                    montserrat400.className
                  }
                  ${
                    isSelected
                      ? isDarkMode
                        ? "bg-[#444340] text-[#D0CCC4]"
                        : "bg-white shadow text-gray-700"
                      : isDarkMode
                      ? "text-[#A9A29A]"
                      : "text-gray-700"
                  }
                  ${
                    isDisabled
                      ? "opacity-70 cursor-not-allowed group relative"
                      : "cursor-pointer"
                  }`}
                >
                  {type === "concise"
                    ? "Concise"
                    : type === "qa"
                    ? "Q&A"
                    : "Detailed"}

                  {isDisabled && (
                    <>
                      <span
                        className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2"
                        onClick={toggleOtherTooltip}
                      >
                        <Lock
                          size={14}
                          className={`${
                            isDarkMode ? "text-[#A9A29A]" : ""
                          } sm:w-6 sm:h-6`}
                        />
                      </span>

                      <div
                        className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white p-2 rounded text-xs w-32 sm:w-40 transition-opacity pointer-events-none ${
                          showOtherTooltip
                            ? "opacity-100 block"
                            : "opacity-0 hidden group-hover:opacity-100 group-hover:block"
                        }`}
                      >
                        You have 0 credits left!
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div
            className={`${
              montserrat500.className
            } flex justify-between text-xs sm:text-md text-center ${
              isDarkMode ? "text-[#A9A29A]" : "text-gray-600"
            } px-1 pt-5`}
          >
            <div className="w-1/3">
              <p>Brief bullet points</p>
              <p>Key concepts only</p>
            </div>
            <div className="w-1/3">
              <p>Question &amp; Answer</p>
              <p>Test Your Knowledge</p>
            </div>
            <div className="w-1/3 relative">
              <p>Comprehensive</p>
              <p>In-depth explanations</p>
            </div>
          </div>
        </div>

        <div
          className={`${
            isDarkMode ? "bg-[#333230]" : "bg-[#D9D9D966]"
          } rounded-xl p-1.5 flex justify-between items-center mt-5 min-h-[50px] sm:h-[65px] transition-colors duration-300`}
        >
          <div className="pl-2 sm:pl-3 flex items-center gap-2 sm:gap-3">
            <div
              className={`p-1 sm:p-2 ${
                isDarkMode ? "bg-[#444340]" : "bg-[#B1745780]"
              } rounded-lg transition-colors duration-300`}
            >
              <Lightbulb
                size={16}
                className={`sm:w-6 sm:h-6 ${
                  isDarkMode ? "text-[#D29C7B]" : ""
                }`}
              />
            </div>
            <p className={`${montserrat500.className} text-base sm:text-xl`}>
              Include Examples
            </p>
          </div>
          <div className="pr-2 sm:pr-4">
            <Switch
              checked={formData.include_examples === "yes"}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  include_examples: checked ? "yes" : "no",
                }))
              }
            />
          </div>
        </div>

        <div
          className={`${
            isDarkMode ? "bg-[#333230]" : "bg-[#D9D9D966]"
          } rounded-xl p-1.5 flex justify-between items-center mt-5 min-h-[50px] sm:h-[65px] transition-colors duration-300 opacity-60 cursor-not-allowed`}
        >
          <div className="pl-2 sm:pl-3 flex items-center gap-2 sm:gap-3">
            <div
              className={`p-1 sm:p-2 ${
                isDarkMode ? "bg-[#444340]" : "bg-[#B1745780]"
              } rounded-lg transition-colors duration-300`}
            >
              <ChartLine
                size={16}
                className={`sm:w-6 sm:h-6 ${
                  isDarkMode ? "text-[#D29C7B]" : ""
                }`}
              />
            </div>
            <p
              className={`${montserrat500.className} text-base sm:text-xl flex items-center`}
            >
              Include Visuals
              <span className="ml-2 relative group" onClick={toggleTooltip}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isDarkMode ? "#A9A29A" : "currentColor"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>

                <span
                  className={`
          absolute left-0 bottom-full mb-2 bg-gray-800 text-white p-2 rounded text-sm w-36 sm:w-48
          transition-opacity duration-200
          ${showTooltip ? "opacity-100 block" : "opacity-0 hidden"}
          group-hover:opacity-100 group-hover:block
          pointer-events-none
        `}
                >
                  Feature temporarily disabled
                </span>
              </span>
            </p>
          </div>
          <div className="pr-2 sm:pr-4">
            <Switch
              checked={false}
              disabled={true}
              onCheckedChange={() => {}}
            />
          </div>
        </div>
      </div>
    );
  };

  const step4Component = () => {
    if (!hasAttemptedGeneration && !isGenerating) {
      return (
        <div
          className={`px-4 pt-1 h-full flex flex-col items-center justify-center ${
            isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
          } transition-colors duration-300`}
        >
          <div className="w-full max-w-md text-center">
            <div className="mb-8">
              <div
                className={`w-16 h-16 ${
                  isDarkMode ? "bg-[#333230]" : "bg-gray-300"
                } rounded-full flex items-center justify-center mx-auto mb-4 transition-colors duration-300`}
              >
                <AlertCircle
                  size={32}
                  className={isDarkMode ? "text-[#A9A29A]" : "text-gray-600"}
                />
              </div>
              <h2 className={`${montserrat500.className} text-2xl`}>
                No Notes Generated Yet
              </h2>
              <p
                className={`${montserrat400.className} text-sm mt-2 ${
                  isDarkMode ? "text-[#A9A29A]" : ""
                }`}
              >
                Please complete steps 1-3 and generate your notes first.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(0)}
              className={`cursor-pointer px-4 py-2 border rounded-lg ${
                isDarkMode
                  ? "bg-[#D29C7B] hover:bg-[#b1876c]"
                  : "bg-[#B17457] hover:bg-[#8f523a]"
              } text-white transition-colors flex items-center gap-2 mx-auto`}
            >
              <span className="text-lg">Start from beginning</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      );
    }

    let title, message;

    if (isInQueue && currentStage === "queued") {
      title = "You're in Queue";
      message = `We're facing high load due to exam season. You can wait or close this tab and check back later in history — we'll also email you once it's processed.`;
    } else if (isGenerating) {
      title = "Your Notes are being generated";
      message = "Please wait while we prepare your notes...";
    } else {
      title = "Your Notes are Ready!";
      message = generationComplete ? "Here's a preview of what we've created" : "";
    }

    return (
      <div
        className={`${
          isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
        } transition-colors duration-300`}
      >
        <div
          className={`pb-5 px-4 flex flex-col sm:flex-row sm:justify-between sm:items-center border-b ${
            isDarkMode ? "border-[#333230]" : "border-gray-300"
          } gap-4 sm:gap-0 transition-colors duration-300`}
        >
          <div
            className={`${montserrat500.className} text-2xl sm:text-4xl flex gap-2 items-center`}
          >
            <BookOpen
              size={24}
              className={`sm:w-10 sm:h-10 ${
                isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
              }`}
            />
            <p className="">Generate Notes</p>
          </div>

          <div
            className={`flex justify-end items-center gap-3 w-full sm:w-auto`}
          >
            <button
              onClick={downloadGeneratedNotes}
              className={`${
                montserrat500.className
              } h-10 flex items-center gap-1.5 px-4 cursor-pointer border ${
                isDarkMode
                  ? "border-[#D29C7B] text-[#D29C7B] hover:bg-[#333230]"
                  : "border-[#B17457] text-[#B17457] hover:bg-gray-100"
              } rounded-md transition text-sm font-medium ${
                !generationComplete || (!markdownContent && !downloadId)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={!generationComplete || (!markdownContent && !downloadId)}
              title="Download notes"
            >
              <Download size={18} />
              <span>Download</span>
            </button>

          </div>
        </div>

        <div className="px-4 pt-4 h-full flex flex-col items-center justify-center">
          {(!generationComplete || isGenerating) && (
            <div className="w-full max-w-md text-center mb-4">
              <div>
                <div
                  className={`sm:w-14 sm:h-14 w-12 h-12 ${
                    isGenerating
                      ? isDarkMode
                        ? "bg-[#444340]"
                        : "bg-[#B1745780]"
                      : isDarkMode
                      ? "bg-[#B17457]"
                      : "bg-[#B17457]"
                  } rounded-full flex items-center justify-center mx-auto mb-3 transition-colors duration-300`}
                >
                  {isGenerating ? (
                    <Loader2
                      size={22}
                      className="text-white animate-spin sm:w-7 sm:h-7"
                    />
                  ) : (
                    <Sparkles size={22} className="text-white sm:w-7 sm:h-7" />
                  )}
                </div>
                <h2 className={`${montserrat500.className} text-xl sm:text-2xl`}>
                  {title}
                </h2>
                <p
                  className={`${montserrat400.className} text-xs sm:text-sm mt-1.5 ${
                    isDarkMode ? "text-[#A9A29A]" : ""
                  } ${
                    isInQueue && currentStage === "queued"
                      ? "text-orange-500"
                      : ""
                  }`}
                >
                  {message}
                </p>
              </div>
            </div>
          )}

          <div
            className={`w-full h-[32rem] sm:h-[38rem] rounded-2xl ${
              isDarkMode
                ? "bg-[#252320] border-[#333230]"
                : "bg-gray-50 border-gray-200"
            } border flex items-center justify-center relative overflow-hidden transition-colors duration-300`}
          >
            {isGenerating ? (
              <div
                className={`text-center backdrop-blur-md ${
                  isDarkMode ? "bg-[#252320]/40" : "bg-white/40"
                } absolute inset-0 flex flex-col items-center justify-center transition-colors duration-300 z-10`}
              >
                <Loader2
                  className={`animate-spin h-10 w-10 ${
                    isDarkMode ? "text-[#A9A29A]" : "text-[#B17457]"
                  } mx-auto mb-4`}
                />
                <p
                  className={`${montserrat500.className} ${
                    isDarkMode ? "text-[#A9A29A]" : "text-gray-700"
                  }`}
                >
                  {isInQueue && currentStage === "queued"
                    ? "Waiting in queue..."
                    : "Generating your notes with AI..."}
                </p>
              </div>
            ) : generationComplete && (markdownContent || downloadId) ? (
              <PDFLikeMarkdownDisplay
                markdownContent={markdownContent}
                isGenerating={isGenerating}
                downloadId={downloadId}
              />
            ) : (
              <div className="text-center p-6">
                <p
                  className={`${montserrat500.className} ${
                    isDarkMode ? "text-[#A9A29A]" : "text-gray-500"
                  }`}
                >
                  No preview available
                </p>
                {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className={`${isDarkMode ? "bg-[#1E1D1B]" : "bg-[#F3EFE5]"} pt-1`}>
        <Navbar />
        <div
          className={`text-center text-3xl sm:text-5xl ${
            isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
          } pt-8 pb-10 ${montserrat600.className}`}
        >
          Generate Notes
        </div>
        <div className="flex flex-col items-center px-4 sm:px-6 pb-6 sm:pb-10 w-full">
          <div className="relative h-6 mb-8 sm:mb-16 w-full sm:w-4/5">
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-full h-3 sm:h-4 rounded-2xl ${
                isDarkMode ? "bg-[#364052]" : "bg-[#D9D9D9]"
              }`}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 sm:h-4 rounded-2xl bg-[#B17457] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />

            <div className="absolute top-full left-0 w-full mt-2">
              {steps.map((label, index) => {
                const edgeInset = 2;
                const stepCount = steps.length - 1;
                const leftPercent =
                  edgeInset + ((100 - edgeInset * 2) / stepCount) * index;
                const isErrorState =
                  (index === 0 && validationErrors.subject_name) ||
                  (index === 1 &&
                    (validationErrors.syllabus ||
                      validationErrors.user_instructions));
                const isNotClickable = index === 3 && !hasAttemptedGeneration;
                return (
                  <div
                    key={index}
                    className={`absolute -translate-x-1/2 text-center ${
                      isNotClickable ? "pointer-events-none opacity-50" : ""
                    }`}
                    style={{ left: `${leftPercent}%` }}
                    onClick={() => handleStepClick(index)}
                  >
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto rounded-full flex items-center justify-center transition-all duration-300
                      ${
                        isNotClickable ? "cursor-not-allowed" : "cursor-pointer"
                      }
                      ${
                        isErrorState
                          ? isDarkMode
                            ? "bg-red-500 border-2 border-red-500"
                            : "bg-red-100 border-2 border-red-500"
                          : currentStep >= index
                          ? isDarkMode
                            ? "bg-[#B17457] border-2 border-[#B17457] text-white"
                            : "bg-white border-2 border-[#B17457] text-[#B17457]"
                          : isDarkMode
                          ? "bg-gray-700 text-gray-400"
                          : "bg-[#D9D9D9] text-gray-600"
                      }
                    `}
                    >
                      {stepsCompleted[index] && currentStep > index ? (
                        <CheckCircle
                          color={
                            isErrorState
                              ? "#EF4444"
                              : isDarkMode
                              ? "#FFFFFF"
                              : "#B17457"
                          }
                          size={16}
                          className="sm:w-6 sm:h-6"
                        />
                      ) : isErrorState ? (
                        <AlertCircle
                          color={isDarkMode ? "#FFFFFF" : "#EF4444"}
                          size={16}
                          className="sm:w-6 sm:h-6"
                        />
                      ) : (
                        React.cloneElement(stepIcons[index], {
                          color:
                            currentStep >= index
                              ? isDarkMode
                                ? "#FFFFFF"
                                : "#B17457"
                              : isDarkMode
                              ? "#A0A0A0"
                              : "#4A4947",
                          size:
                            typeof window !== "undefined"
                              ? window.innerWidth < 640
                                ? 16
                                : 20
                              : 20,
                        })
                      )}
                    </div>

                    <div
                      className={`text-xs sm:text-sm mt-1 ${
                        isErrorState ? "text-red-500 font-medium" : ""
                      }`}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`${
              isDarkMode ? "bg-[#252320]" : "bg-white"
            } shadow-md rounded-lg p-4 sm:p-6 min-h-[300px] w-full max-w-[65rem] mt-15 sm:mt-10`}
          >
            <div
              className={`flex flex-col gap-4 h-auto ${
                currentStep === 1
                  ? "sm:h-[66.5rem] md:h-[61.5rem] lg:h-[47.5rem]"
                  : currentStep === 3
                  ? "min-h-[40rem]"
                  : "sm:h-[40rem]"
              }`}
            >
              {currentStep === 0 && step1Component()}
              {currentStep === 1 && step2Component()}
              {currentStep === 2 && step3Component()}
              {currentStep === 3 && step4Component()}
            </div>
            <hr className="border-none h-px bg-[rgba(0,0,0,0.19)] my-4 -mx-4 sm:-mx-6" />

            <div
              className={`flex ${
                currentStep === 0 ? "justify-end" : "justify-between"
              } mt-4 sm:mt-6 mx-2 sm:mx-10`}
            >
              {currentStep !== 0 && currentStep !== 3 && (
                <button
                  className={`${
                    isDarkMode ? "hover:bg-[#1E1D1B]" : "hover:bg-gray-100"
                  } cursor-pointer px-2 sm:px-4 py-1 sm:py-2 border border-[#B17457] rounded-lg transition-colors flex items-center gap-1 sm:gap-2 `}
                  onClick={() =>
                    setCurrentStep((prev) => Math.max(prev - 1, 0))
                  }
                >
                  <ArrowLeft size={16} className="sm:w-5 sm:h-5" />
                  <span className="text-sm sm:text-lg">Back</span>
                </button>
              )}

              {currentStep < 3 && (
                <button
                  className="cursor-pointer px-2 sm:px-4 py-1 sm:py-2 border rounded-lg bg-[#B17457] text-white transition-colors flex items-center gap-1 sm:gap-2 hover:bg-[#8f523a]"
                  onClick={() => {
                    if (currentStep === 2) {
                      handleSubmit();
                    } else {
                      setCurrentStep((prev) =>
                        Math.min(prev + 1, steps.length - 1)
                      );
                    }
                  }}
                >
                  <span className="text-sm sm:text-lg">
                    {currentStep === 2 ? "Generate Notes" : "Continue"}
                  </span>
                  {currentStep === 2 ? (
                    <Sparkles size={16} className="sm:w-5 sm:h-5" />
                  ) : (
                    <ArrowRight size={16} className="sm:w-5 sm:h-5" />
                  )}
                </button>
              )}
              {currentStep === 3 && (
                <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="w-full flex justify-center sm:justify-start">
                    {renderGenerationStatus()}
                  </div>

                  {generationComplete && (
                    <div className="w-full flex justify-between sm:w-auto sm:justify-end gap-2 sm:gap-4">
                      <button
                        onClick={handleSubmit}
                        className={`cursor-pointer h-10 sm:h-10 px-3 sm:px-4 border rounded-lg transition-colors flex items-center gap-2 text-sm ${
                          isDarkMode
                            ? ""
                            : "bg-white text-black border-[#B17457] hover:bg-gray-100"
                        }`}
                      >
                        <Redo size={16} className="w-4 h-4" />
                        <span>Regenerate</span>
                      </button>

                      <button
                        className="cursor-pointer h-10 w-43 sm:h-10 px-3 sm:px-4 border rounded-lg bg-[#B17457] text-white transition-colors flex items-center gap-2 hover:bg-[#8f523a] text-sm"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to start over? This will clear all your input."
                            )
                          ) {
                            setCurrentStep(0);
                            setFormData({
                              email: user?.email,
                              syllabus: "",
                              subject_name: "",
                              user_instructions: "",
                              note_type: "concise",
                              education_level: "beginner",
                              include_examples: "yes",
                              include_images: "no",
                              relativePathToReferenceMaterial: "",
                            });
                            setGenerationComplete(false);
                            setMarkdownContent("");
                            setDownloadId("");
                            setHasAttemptedGeneration(false);
                            // Stop any active polling
                            if (pollingIntervalRef.current) {
                              clearInterval(pollingIntervalRef.current);
                              pollingIntervalRef.current = null;
                            }
                          }
                        }}
                      >
                        <span>Create New Notes</span>
                        <Sparkles size={16} className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesGenerate;
