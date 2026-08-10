"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/lib/constant";
import { montserrat700, montserrat500 } from "@/lib/font-utils";

export function Faq() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted && resolvedTheme === "dark";

  return (
    <main
      className={`w-full ${isDarkMode ? "bg-[#1E1D1B]" : "bg-[#FAF7F0]"} py-10`}
    >
      <div
        className={`w-full text-xl sm:text-5xl text-center mb-6 sm:mb-10 ${
          isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
        } ${montserrat700.className}`}
      >
        <p>Frequently Asked Questions</p>
      </div>
      <section
        className={`flex flex-col items-center justify-center ${
          isDarkMode ? "bg-[#1E1D1B]" : "bg-[#FAF7F0];"
        }`}
      >
        <Accordion
          type="single"
          collapsible
          className={`w-full max-w-5xl px-4 sm:px-0 ${montserrat500.className}`}
        >
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger
                className={`${
                  isDarkMode ? "text-white" : "text-black"
                } cursor-pointer`}
              >
                {faq.question}
              </AccordionTrigger>

              <AccordionContent
                className={isDarkMode ? "text-white" : "text-[#4A4947]"}
              >
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </main>
  );
}
