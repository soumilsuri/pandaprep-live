"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useTheme } from "next-themes";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { BASE_URL } from "@/lib/constant";
import { auth } from "@/firebase/firebaseconfig";


const CookieConsent = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const router = useRouter();


  const isDarkMode = mounted && resolvedTheme === "dark";


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIdToken(null);
      } else {
        const token = await user.getIdToken();
        setIdToken(token);
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (idToken) {
      handleGetUser();
    }
  }, [idToken]);

  const handleGetUser = async () => {
    try {
      setLoading(true);
      const data = await axios.get(`${BASE_URL}/user/get`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      setShowPopup(!data.data.cookieAcknowledged);
    } catch (error) {
      console.error("Error fetching cookie status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      if (idToken) {
        await axios.post(
          `${BASE_URL}/user/update-cookie`,
          {
            email: auth.currentUser?.email,
            cookieAcknowledged: true,
          },
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );
      }

      setShowPopup(false);
    } catch (error) {
      console.error("Error updating cookie status:", error);
    }
  };

  if (loading || !showPopup || !mounted) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 ${
        isDarkMode
          ? "bg-[#1E1D1B] border-t border-[#D29C7B] text-[#FAF7F0]"
          : "bg-[#FAF7F0] border-t-2 border-[#B17457] text-[#4A4947]"
      } p-4 shadow-lg z-50`}
    >
      <div className="container mx-auto flex flex-col px-8 md:flex-row items-center justify-between">
        <div className="mb-4 md:mb-0 pr-4 max-w-3xl">
          <p className="text-sm">
            This website uses cookies to enhance your experience. By continuing
            to use this site, you agree to our use of cookies and our privacy
            policy.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleAccept}
            className={`
              ${
                isDarkMode
                  ? "bg-[#1E1D1B] border border-[#D29C7B] text-[#FAF7F0] hover:bg-[#9e765e] hover:border-[#D29C7B] hover:text-[#1E1D1B]"
                  : "bg-[#FAF7F0] border-2 border-[#B17457] text-[#B17457] hover:bg-[#B17457] hover:border-[#B17457] hover:text-[#FAF7F0]"
              }
              font-bold text-sm rounded-[15px] px-4 py-2 transition duration-300 ease-in-out cursor-pointer
            `}
          >
            Accept
          </button>
          <a
            href="/privacy-policy"
            className={`
              ${
                isDarkMode
                  ? "text-[#D29C7B] hover:text-[#FAF7F0]"
                  : "text-[#B17457] hover:text-[#4A4947]"
              }
              text-sm py-2 underline transition-colors
            `}
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
