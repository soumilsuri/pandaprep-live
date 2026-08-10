"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { montserrat600 } from "@/lib/font-utils";

const Footer = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <footer
      className={cn(
        "bottom-0 left-0 w-full px-6 py-6 backdrop-blur-lg border-t border-[#B17457]  transition-colors duration-300 z-50",
        isDarkMode
          ? "bg-[#1E1D1B]  text-white"
          : "bg-[#FAF7F0]  text-black",
        montserrat600.className
      )}
    >
      <div className=" mt-3 mb-2 max-w-7xl mx-auto flex flex-col items-center justify-center space-y-4">
        <nav className={`flex flex-wrap justify-center text-lg gap-6 ${isDarkMode?"text-[#D0CCC4]":"text-[#4A4947]"}`}>
          <Link href="/" className="transition-colors hover:text-[#8F4B2D]">
            About
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-[#8F4B2D]">
            Pricing
          </Link>
        </nav>

        <div className="mt-3 flex flex-wrap justify-center gap-6 text-sm text-neutral-400">
          <Link href="/privacy-policy" className="hover:text-[#B17457] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms-and-conditions" className="hover:text-[#B17457] transition-colors">
            Terms and Conditions
          </Link>
          <Link href="/contact" className="hover:text-[#B17457] transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
