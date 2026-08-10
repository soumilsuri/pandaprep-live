// components/global/HealthCheckWrapper.jsx
"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

import { 
  montserrat600, 
  montserrat700, 
  montserrat800
} from "@/lib/font-utils";

import { PropsWithChildren } from "react";
import axios from "axios";
import { BASE_URL } from "@/lib/constant";

export default function HealthCheckWrapper({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, resolvedTheme } = useTheme();
  
  const [mounted, setMounted] = useState(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);

    const checkBackendHealth = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/health-check`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
        
        if (response.status === 200) {
          setIsBackendHealthy(true);
        } else {
          setIsBackendHealthy(false);
          if (pathname !== '/') {
            router.push('/');
          }
        }
      } catch (error) {
        console.error('Failed to check backend health:', error);
        setIsBackendHealthy(false);
        if (pathname !== '/') {
          router.push('/');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkBackendHealth();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? "bg-[#1E1D1B] text-[#FAF7F0]" : "bg-[#FAF7F0] text-[#4A4947]"}`}>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-t-[#D29C7B] rounded-full animate-spin"></div>
          <p className={`${montserrat600.className} mt-4 text-lg`}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isBackendHealthy) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen px-4 ${isDarkMode ? "bg-[#1E1D1B] text-[#FAF7F0]" : "bg-[#FAF7F0] text-[#4A4947]"}`}>
        <div className="text-center max-w-lg">
          <h1 className={`${montserrat800.className} text-3xl md:text-4xl mb-4`}>Under Maintenance</h1>
          <p className={`${montserrat600.className} text-lg mb-8`}>
            We&#39;re currently performing some updates to make your experience better. 
            Please check back soon!
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className={`${montserrat700.className} px-6 py-3 rounded-lg cursor-pointer ${
              isDarkMode 
                ? "bg-[#D29C7B] text-[#1E1D1B] hover:bg-[#B17457]" 
                : "bg-[#B17457] text-[#FAF7F0] hover:bg-[#9e765e]"
            } transition duration-300`}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return children;
}