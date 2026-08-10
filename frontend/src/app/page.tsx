"use client";

import Navbar from "@/components/global/navbar";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { FeatureSection } from "@/components/global/features";
import { useRouter } from "next/navigation";
import {
  montserrat600,
  montserrat700,
  montserrat800,
  indieFlower,
} from "@/lib/font-utils";
import { ArrowUpRight } from "lucide-react";
import { Faq } from "@/components/global/faq";
import heroBulbLight from "../../public/assets/hero-bulb-light.png";
import heroBulbDark from "../../public/assets/hero-bulb-dark.png";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDarkMode = mounted && resolvedTheme === "dark";
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main
      className={`overflow-x-hidden ${isDarkMode ? "bg-[#1E1D1B]" : "bg-[#FAF7F0]"
        } `}
    >
      <Navbar />
      <div className="flex flex-col items-center justify-center h-[30rem] sm:min-h-screen px-4 py-8 md:py-0 sm:pt-0 pt-28">
        <p
          className={`${indieFlower.className} text-[2rem] md:text-[3.125rem] ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
            } text-center`}
        >
          From Chaos to Clarity
        </p>
        <p
          className={`${montserrat600.className
            } text-[1rem] md:text-[1.25rem] ${isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
            } text-center px-2`}
        >
          Stop stressing over messy notes — Our AI helps you focus, learn
          faster, <br className="hidden md:block" /> and retain more with every
          study session.
        </p>
        <div className="w-full max-w-[45rem] px-4 mt-4">
          <Image
            src={isDarkMode ? heroBulbDark : heroBulbLight}
            alt="hero-bulb"
            className="w-full h-auto"
          />
        </div>

        <div className="flex flex-col items-center justify-center mt-6 md:mt-10">
          <button
            onClick={() => router.push("/auth")}
            className={`
    ${isDarkMode
                ? "bg-[#1E1D1B] border border-[#D29C7B] text-[#FAF7F0] hover:bg-[#9e765e] hover:border-[#D29C7B] hover:text-[#1E1D1B]"
                : "bg-[#FAF7F0] border-2 border-[#B17457] text-[#B17457] hover:bg-[#B17457] hover:border-[#B17457] hover:text-[#FAF7F0]"
              }
    font-bold text-[1rem] md:text-[1.25rem] rounded-[15px] w-[180px] md:w-[215px] h-[45px] md:h-[55px] 
    shrink-0 transition duration-300 ease-in-out ${montserrat700.className
              } flex items-center justify-center gap-1 cursor-pointer
  `}
          >
            <p>Get Started</p>
            <ArrowUpRight strokeWidth={3} />
          </button>
        </div>
      </div>

      <div
        className={`flex justify-center ${isDarkMode
            ? "bg-neutral-950 text-white"
            : "bg-[#FAF7F0] text-[#4A4947]"
          }`}
      >
        <section className="w-full">
          <FeatureSection />
        </section>
      </div>

      <div className="flex justify-center px-4 pb-24 sm:px-8 md:px-16 lg:px-32">
        <section className="w-full">
          <Faq />
        </section>
      </div>
    </main>
  );
}
