import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { montserrat600, montserrat700 } from "@/lib/font-utils";
import heroPanda1 from "../../../public/assets/hero-panda-1.png";
import heroPanda2 from "../../../public/assets/hero-panda-2.png";
import heroPanda3 from "../../../public/assets/hero-panda-3.png";
import carouselPanda1Light from "../../../public/assets/scribble-panda-1-light.png";
import carouselPanda2Light from "../../../public/assets/scribble-panda-2-light.png";
import carouselPanda1Dark from "../../../public/assets/scribble-panda-1-dark.png";
import carouselPanda2Dark from "../../../public/assets/scribble-panda-2-dark.png";

export function FeatureSection() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDarkMode = mounted && resolvedTheme === "dark";
  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [windowWidth, setWindowWidth] = useState(0);

  const cards = [
    {
      image: heroPanda1,
      title: "Dynamic notes generation",
      description:
        "Transform lengthy lectures into concise, organized study materials in seconds. Our AI-powered notes generator creates structured summaries, key concept breakdowns, and practice questions from your course content.",
    },
    {
      image: heroPanda2,
      title: "Chat with your notes",
      description:
        "Interact with your PDFs in a whole new way! Our PDF chat feature allows you to extract key information, ask questions, and get summaries directly from your PDF files with AI-powered chat support.",
    },
    {
      image: heroPanda3,
      title: "Notes summarizer",
      description:
        "Summarize your lengthy notes into concise and easy-to-digest versions. The Notes Summarizer uses AI to highlight key points, concepts, and sections, making it easier for you to study.",
    },
  ];

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
    }, 3000);
    setIntervalId(interval as NodeJS.Timeout);

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
    };
  }, [cards.length]);

  const handleManualSlideChange = (index: number) => {
    setCurrentSlide(index);
    if (intervalId) {
      clearInterval(intervalId);
      const newInterval = setInterval(() => {
        setCurrentSlide((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
      }, 3000);
      setIntervalId(newInterval as NodeJS.Timeout);
    }
  };

  const showDecorativePandas = windowWidth >= 1450;

  return (
    <div
      className={`w-full pb-4 sm:pb-8 md:pb-16 ${isDarkMode ? "bg-[#1E1D1B]" : "bg-[#FAF7F0]"
        } overflow-x-hidden px-1 xs:px-2 sm:px-8 md:px-12 lg:px-20 ${montserrat600.className
        }`}
    >
      <div className="flex flex-col items-center justify-center">
        <h2
          className={`${montserrat700.className
            } text-lg xs:text-xl sm:text-3xl md:text-4xl lg:text-5xl ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
            } mb-2 sm:mb-4 md:mb-12 text-center`}
        >
          Your Ultimate Learning Toolkit
        </h2>

        <div className="relative max-w-5xl mx-auto">
          {showDecorativePandas && (
            <div className="absolute left-[-200px] top-[-90px] z-10">
              <Image
                src={isDarkMode ? carouselPanda1Dark : carouselPanda1Light}
                alt="Decorative panda illustration"
                width={275}
                height={150}
              />
            </div>
          )}

          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {cards.map((card, index) => (
                <div key={index} className="min-w-full px-0 xs:px-1 sm:px-2">
                  <div className="border border-[#B17457] rounded-lg xs:rounded-xl flex flex-col md:flex-row w-full h-auto md:h-[400px] p-1 xs:p-2 sm:p-4 md:p-0">
                    <div className="flex items-center justify-center w-full md:w-2/5 mb-1 xs:mb-2 sm:mb-4 md:mb-0">
                      <Image
                        src={card.image}
                        alt={`Feature illustration for ${card.title}`}
                        className="h-[80px] w-[80px] xs:h-[100px] xs:w-[100px] sm:h-[150px] sm:w-[150px] md:h-[250px] md:w-[250px] lg:h-[300px] lg:w-[300px] rounded-2xl xs:rounded-3xl"
                      />
                    </div>
                    <div className="text-center flex flex-col items-center justify-center w-full md:w-3/5 px-0.5 xs:px-1 sm:px-2 md:px-4 lg:px-6">
                      <div
                        className={`${montserrat600.className} ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
                          } text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold`}
                      >
                        {card.title}
                      </div>
                      <div
                        className={`${montserrat600.className} ${isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
                          } text-xs sm:text-sm md:text-base lg:text-lg pt-0.5 xs:pt-1 sm:pt-2`}
                      >
                        {card.description}
                      </div>
                      {index !== 2 ? (
                        <button
                          onClick={() => router.push(index === 0 ? "/generate" : "/chat")}
                          className={`mt-1 xs:mt-2 sm:mt-3 md:mt-4 px-2 xs:px-3 md:px-4 py-0.5 xs:py-1 md:py-2 rounded text-xs xs:text-sm md:text-base cursor-pointer transition
                          ${isDarkMode
                              ? "bg-[#B17457] hover:bg-[#a76348] text-white"
                              : "bg-[#B17457] hover:bg-[#a76348] text-white"
                            }
                        `}
                        >
                          Try Now
                        </button>
                      ) : (
                        <button
                          disabled
                          className={`mt-1 xs:mt-2 sm:mt-3 md:mt-4 px-2 xs:px-3 md:px-4 py-0.5 xs:py-1 md:py-2 rounded text-xs xs:text-sm md:text-base cursor-not-allowed
                            ${isDarkMode ? "bg-gray-600 text-gray-300" : "bg-gray-400 text-white"}
                          `}
                        >
                          Coming Soon
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center mt-1 xs:mt-2 sm:mt-4 md:mt-8 space-x-1 xs:space-x-2">
            {cards.map((_, index) => (
              <button
                key={index}
                onClick={() => handleManualSlideChange(index)}
                className={`w-1 xs:w-1.5 sm:w-2 md:w-3 h-1 xs:h-1.5 sm:h-2 md:h-3 rounded-full transition-all ${currentSlide === index
                    ? "bg-[#B17457] w-2 xs:w-3 sm:w-4 md:w-6"
                    : "bg-gray-300"
                  }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {showDecorativePandas && (
            <div className="absolute right-[-100px] bottom-[-40px] z-10">
              <Image
                src={isDarkMode ? carouselPanda2Dark : carouselPanda2Light}
                alt="Decorative panda illustration"
                width={175}
                height={175}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}