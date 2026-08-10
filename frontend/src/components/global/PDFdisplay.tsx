import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

const PDFLikeMarkdownDisplay = ({
  markdownContent,
  isGenerating,
  downloadId,
}: {
  markdownContent: string;
  isGenerating: boolean;
  downloadId: string;
}) => {
  const [pages, setPages] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    if (!markdownContent || markdownContent.trim() === "") {
      setPages([]);
      return;
    }

    const splitContent = markdownContent.split(/\n\n+/);
    const newPages: string[] = [];
    let currentContent = "";

    splitContent.forEach((paragraph) => {
      if (currentContent.length + paragraph.length > 1200) {
        newPages.push(currentContent.trim());
        currentContent = paragraph;
      } else {
        currentContent += `\n\n${paragraph}`;
      }
    });

    if (currentContent) newPages.push(currentContent.trim());

    setPages(newPages);
  }, [markdownContent]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [pages]);

  return (
    <>
      {downloadId ? (
        <iframe
          src={`${downloadId}#zoom=80&toolbar=0&navpanes=0`}
          className="w-full h-full border-0 rounded-lg"
          style={{ maxWidth: "8.5in", height: "50rem" }}
          title="PDF Viewer"
        />
      ) : (
        <div
          ref={containerRef}
          className={`pdf-container flex flex-col items-center gap-6 py-8 overflow-y-auto h-full w-full px-4 rounded-xl ${
            isDarkMode ? "bg-[#121212]" : "bg-gray-100"
          }`}
        >
          {pages.length === 0 && (
            <p
              className={`text-lg mt-64 italic text-center ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {isGenerating
                ? "Notes content will appear here as it's generated..."
                : "Generated notes will appear here"}
            </p>
          )}

          {pages.length > 0 && (
            <div className="overflow-y-auto space-y-6 max-w-[8.5in] w-full px-4">
              {pages.map((page, index) => (
                <motion.div
                  key={`page-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`pdf-page shadow-lg rounded-lg overflow-hidden p-10 border text-lg leading-relaxed font-serif text-justify w-full ${
                    isDarkMode
                      ? "bg-[#1E1E1E] text-gray-300 border-gray-700"
                      : "bg-white text-gray-900 border-gray-300"
                  }`}
                  style={{ maxWidth: "8.5in", minHeight: "auto" }}
                >
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {page}
                  </ReactMarkdown>
                  <div
                    className={`text-right text-sm mt-4 ${
                      isDarkMode ? "text-gray-500" : "text-gray-400"
                    }`}
                  >
                    Page {index + 1} of {pages.length}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PDFLikeMarkdownDisplay;