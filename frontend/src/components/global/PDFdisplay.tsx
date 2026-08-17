"use client";

import React, { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { useTheme } from "next-themes";
import { Copy, Check, FileText } from "lucide-react";

interface PDFLikeMarkdownDisplayProps {
  markdownContent: string;
  isGenerating?: boolean;
  downloadId?: string;
}

const PDFLikeMarkdownDisplay: React.FC<PDFLikeMarkdownDisplayProps> = ({
  markdownContent,
  isGenerating = false,
  downloadId,
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted && resolvedTheme === "dark";

  const handleCopy = async () => {
    if (!markdownContent) return;
    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy markdown:", err);
    }
  };

  if (downloadId) {
    return (
      <iframe
        src={`${downloadId}#zoom=80&toolbar=0&navpanes=0`}
        className="w-full h-full border-0 rounded-lg"
        title="PDF Viewer"
      />
    );
  }

  if (!markdownContent || markdownContent.trim() === "") {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px] rounded-xl ${
          isDarkMode ? "text-[#A9A29A]" : "text-gray-500"
        }`}
      >
        <FileText className="w-10 h-10 mb-3 opacity-40 animate-pulse" />
        <p className="text-base font-medium">
          {isGenerating
            ? "Generating notes content..."
            : "Generated notes will appear here"}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-y-auto rounded-xl p-4 sm:p-8 transition-colors duration-300 ${
        isDarkMode
          ? "bg-[#1E1D1B] text-[#D0CCC4]"
          : "bg-white text-[#2B2B2B] shadow-inner"
      }`}
    >
      {/* Quick Action bar (hidden in print) */}
      <div className="no-print sticky top-0 z-10 flex justify-end pb-3">
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-all ${
            isDarkMode
              ? "bg-[#2A2825] border-[#444340] text-[#D0CCC4] hover:bg-[#333230]"
              : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
          title="Copy Markdown"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy Markdown</span>
            </>
          )}
        </button>
      </div>

      {/* Printable / Rendered Markdown Content */}
      <div
        id="printable-notes-section"
        className={`printable-notes max-w-4xl mx-auto space-y-4 leading-relaxed font-sans text-sm sm:text-base ${
          isDarkMode ? "dark-prose" : "light-prose"
        }`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={{
            h1: ({ node, ...props }) => (
              <h1
                className={`text-2xl sm:text-3xl font-bold pb-2 mb-4 border-b ${
                  isDarkMode
                    ? "text-[#FAF7F0] border-[#3E3C38]"
                    : "text-[#1E1D1B] border-gray-200"
                }`}
                {...props}
              />
            ),
            h2: ({ node, ...props }) => (
              <h2
                className={`text-xl sm:text-2xl font-semibold mt-6 mb-3 pb-1 border-b ${
                  isDarkMode
                    ? "text-[#FAF7F0] border-[#333230]"
                    : "text-[#2B2B2B] border-gray-100"
                }`}
                {...props}
              />
            ),
            h3: ({ node, ...props }) => (
              <h3
                className={`text-lg sm:text-xl font-semibold mt-5 mb-2 ${
                  isDarkMode ? "text-[#E6E2D8]" : "text-[#333230]"
                }`}
                {...props}
              />
            ),
            p: ({ node, ...props }) => (
              <p className="my-2.5 leading-relaxed text-justify" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc list-inside space-y-1 my-3 pl-2" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal list-inside space-y-1 my-3 pl-2" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="my-1 pl-1 leading-normal" {...props} />
            ),
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4 rounded-lg border border-gray-300 dark:border-[#444340]">
                <table
                  className={`w-full text-left border-collapse text-xs sm:text-sm ${
                    isDarkMode ? "bg-[#252320]" : "bg-white"
                  }`}
                  {...props}
                />
              </div>
            ),
            th: ({ node, ...props }) => (
              <th
                className={`px-3 py-2 border-b font-semibold ${
                  isDarkMode
                    ? "bg-[#333230] text-[#FAF7F0] border-[#444340]"
                    : "bg-gray-100 text-gray-900 border-gray-300"
                }`}
                {...props}
              />
            ),
            td: ({ node, ...props }) => (
              <td
                className={`px-3 py-2 border-t ${
                  isDarkMode
                    ? "border-[#3A3835] text-[#D0CCC4]"
                    : "border-gray-200 text-gray-800"
                }`}
                {...props}
              />
            ),
            blockquote: ({ node, ...props }) => (
              <blockquote
                className={`border-l-4 pl-4 py-1.5 my-3 italic rounded-r ${
                  isDarkMode
                    ? "border-[#B17457] bg-[#252320] text-[#C0BCB4]"
                    : "border-[#B17457] bg-amber-50/50 text-gray-700"
                }`}
                {...props}
              />
            ),
            code: ({ node, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match && !String(children).includes("\n");
              if (isInline) {
                return (
                  <code
                    className={`px-1.5 py-0.5 rounded text-xs sm:text-sm font-mono ${
                      isDarkMode
                        ? "bg-[#2E2C28] text-[#E89E7A]"
                        : "bg-gray-100 text-[#B17457]"
                    }`}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <div className="relative my-3 rounded-lg overflow-hidden border border-gray-200 dark:border-[#3E3C38]">
                  <pre
                    className={`p-3.5 overflow-x-auto text-xs sm:text-sm font-mono leading-normal ${
                      isDarkMode
                        ? "bg-[#161514] text-[#E0DDD5]"
                        : "bg-gray-900 text-gray-100"
                    }`}
                  >
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            },
            hr: ({ node, ...props }) => (
              <hr
                className={`my-6 border-t ${
                  isDarkMode ? "border-[#3E3C38]" : "border-gray-300"
                }`}
                {...props}
              />
            ),
            a: ({ node, ...props }) => (
              <a
                className="text-[#B17457] hover:underline font-medium break-all"
                {...props}
              />
            ),
          }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default PDFLikeMarkdownDisplay;