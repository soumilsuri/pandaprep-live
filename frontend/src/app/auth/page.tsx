"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import app from "@/firebase/firebaseconfig";
import Image from "next/image";
import { montserrat500, montserrat600, montserrat700 } from "@/lib/font-utils";
import axios from "axios";
import { BASE_URL } from "@/lib/constant";
import { setCookie } from "@/lib/utils";
import { useTheme } from "next-themes";

const AuthPage = () => {
  const auth = getAuth(app);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setTimeout(() => router.push("/generate"), 1500);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSignIn = async (providerType: "google" | "github") => {
    const provider =
      providerType === "google"
        ? new GoogleAuthProvider()
        : new GithubAuthProvider();
    try {
      const response: any = await signInWithPopup(auth, provider);

      try {
        const reqBody = {
          uid: response.user.uid,
          email: response.user.email,
          displayName: response.user.displayName,
          photoURL: response.user.photoURL,
          providerId: response.user.providerData?.[0]?.providerId || null,
          createdAt: response.user.metadata?.creationTime || null,
          lastLoginAt: response.user.metadata?.lastSignInTime || null,
          providerData: response.user.providerData || [],
          tokens: response.user.stsTokenManager || {},
        };

        await axios.post(`${BASE_URL}/user/signin`, reqBody);
      } catch (error: any) {
        console.error("Internal Server Error:", error);
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      if (error.code === "auth/account-exists-with-different-credential") {
        alert(
          "An account already exists with this email using a different sign-in method. Try another option."
        );
      }
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen p-4 ${isDarkMode ? "bg-[#121110]" : "bg-[#FAF7F0]"} transition-colors duration-300`}>
      <div className={`w-full max-w-3xl rounded-2xl p-6 sm:p-10 flex flex-col border ${isDarkMode ? "bg-[#1E1D1B] border-[#2A2826] shadow-xl text-[#E0DCD5]" : "bg-white border-[#E8E3D9] shadow-lg text-[#4A4947]"} transition-all duration-300`}>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6">
          <h1 className={`text-4xl sm:text-5xl font-extrabold ${montserrat700.className} ${isDarkMode ? "text-[#E5A382]" : "text-[#4A4947]"} transition-colors duration-300`}>
            Welcome
          </h1>
          <p className={`text-lg mt-4 ${montserrat600.className} ${isDarkMode ? "text-[#A9A29A]" : "text-[#B17457]"} transition-colors duration-300`}>
            Unlock your brain-panda! Login to unleash the notes.
          </p>
        </div>
        <div className={`flex-1 p-4 sm:p-6 flex flex-col items-center justify-center rounded-2xl ${isDarkMode ? "bg-[#252320]" : "bg-[#D8D2C2]/30"} transition-colors duration-300`}>
          {user ? (
            <div className="flex flex-col items-center text-center">
              <Image
                src={user.photoURL || "/default-avatar.png"}
                alt="User Avatar"
                width={70}
                height={70}
                className={`rounded-full border-2 ${isDarkMode ? "border-[#E5A382]" : "border-[#B17457]"} transition-colors duration-300`}
              />
              <p className={`mt-4 font-medium text-xl ${montserrat600.className} ${isDarkMode ? "text-[#E0DCD5]" : "text-[#4A4947]"} transition-colors duration-300`}>
                {user.displayName}
              </p>
              <p className={`${montserrat500.className} ${isDarkMode ? "text-[#E5A382]" : "text-[#B17457]"} transition-colors duration-300`}>
                {user.email}
              </p>
              <p className={`font-medium mt-6 ${montserrat600.className} ${isDarkMode ? "text-[#A9A29A]" : "text-[#4A4947]"} transition-colors duration-300`}>
                Your Notes are just one step away...
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleSignIn("google")}
                className={`w-full cursor-pointer max-w-xs p-3 flex items-center justify-center gap-3 rounded-lg shadow-md transition duration-300 ${isDarkMode 
                  ? "bg-[#2D2B29] border border-[#383531] text-[#E0DCD5] hover:border-[#E5A382] hover:shadow-lg" 
                  : "bg-white border border-[#C9C3B3] text-[#4A4947] hover:border-[#B17457] hover:shadow-lg"}`}
              >
                <Image
                  src="https://www.gstatic.com/images/branding/product/1x/gsa_48dp.png"
                  alt="Google Logo"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span className={`font-medium ${montserrat600.className}`}>
                  Sign in with Google
                </span>
              </button>
              <button
                onClick={() => handleSignIn("github")}
                className={`mt-4 cursor-pointer w-full max-w-xs p-3 flex items-center justify-center gap-3 rounded-lg shadow-md transition duration-300 ${isDarkMode 
                  ? "bg-[#333230] text-[#E0DCD5] hover:bg-[#403E3B] hover:shadow-lg" 
                  : "bg-[#4A4947] text-white hover:bg-[#5D5B58] hover:shadow-lg"}`}
              >
                <Image
                  src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
                  alt="GitHub Logo"
                  width={24}
                  height={24}
                  className={`w-6 h-6 rounded-full ${isDarkMode ? "" : "bg-white"}`}
                />
                <span className={`font-medium ${montserrat600.className}`}>
                  Sign in with GitHub
                </span>
              </button>
              <button
                onClick={() => router.push("/")}
                className={`mt-6 cursor-pointer px-6 py-2 border-2 rounded-lg shadow-md transition duration-300 ${montserrat600.className} ${isDarkMode 
                  ? "border-[#E5A382] text-[#E5A382] hover:bg-[#E5A382] hover:text-[#121110]" 
                  : "border-[#B17457] text-[#B17457] hover:bg-[#B17457] hover:text-white"}`}
              >
                Back to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;