"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun, ChevronDown, ChevronUp, Lock, Menu, X } from "lucide-react";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import app from "@/firebase/firebaseconfig";
import { deleteCookie } from "@/lib/utils";
import { montserrat500, montserrat700 } from "@/lib/font-utils";

const Navbar = () => {
  const auth = getAuth(app);
  const router = useRouter();
  const pathname = usePathname();

  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDarkMode = mounted && resolvedTheme === "dark";

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownRef, setDropdownRef] = useState<HTMLElement | null>(null);
  const [servicesDropdown, setServicesDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef && dropdownRef.contains(event.target as Node)) {
        return;
      }
      setServicesDropdown(false);
      setDropdownOpen(false);
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [dropdownRef]);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1100);
    };

    checkScreenSize();

    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [router, isMobile]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      deleteCookie("jwt-auth");
      deleteCookie("email");
      router.push("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when mobile menu opens
  useEffect(() => {
    if (menuOpen) {
      setDropdownOpen(false);
      setServicesDropdown(false);
    }
  }, [menuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [menuOpen]);

  return (
    <div className={`py-[0.5rem] px-6 my-6 mx-2 lg:mx-10 rounded-[1.5rem] border flex justify-between items-center ${pathname === "/generate" ? "" : "fixed top-0 left-0 right-0 z-50"} ${isDarkMode ? "bg-[#3A3935] border-[#504E49]" : "bg-[#D8D2C2] border-[#C9C3B3]"}`}>
      <div
        onClick={() => router.push("/")}
        className={`${montserrat700.className} text-[1.25rem] sm:text-[2rem] cursor-pointer ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}
      >
        PandaPrepAI
      </div>

      <div className="hidden lg:flex gap-12 items-center relative mr-6">
        <div className="relative">
          <button
            onClick={() => setServicesDropdown(!servicesDropdown)}
            className={`${montserrat500.className} text-[1.5rem] flex items-center gap-2 cursor-pointer ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}
          >
            <span>Services</span>
            {servicesDropdown ? (
              <ChevronUp size={24} strokeWidth={2} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} />
            ) : (
              <ChevronDown size={24} strokeWidth={2} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} />
            )}
          </button>

          <AnimatePresence>
            {servicesDropdown && (
              <motion.div
                ref={setDropdownRef}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`absolute top-[3rem] right-0 backdrop-blur-md border rounded-2xl shadow-2xl py-3 w-72 z-50 flex flex-col overflow-hidden ${isDarkMode
                  ? "bg-[#3A3935]/70 border-[#504E49]"
                  : "bg-white/70 border-[#C9C3B3]"
                  }`}
              >
                <Link
                  href="/generate"
                  className={`px-5 py-3 hover:bg-opacity-20 text-[1.25rem] transition-all duration-200 hover:pl-6 ${isDarkMode
                    ? "text-[#D0CCC4] hover:bg-[#D0CCC4] hover:text-black"
                    : "text-[#4A4947] hover:bg-[#f0eee9]"
                    }`}
                >
                  Notes Generator
                </Link>
                <div className={`border-t mx-4 ${isDarkMode ? "border-[#504E49]" : "border-[#C9C3B3]"}`} />
                <Link
                  href="/chat"
                  className={`px-5 py-3 hover:bg-opacity-20 text-[1.25rem] transition-all duration-200 hover:pl-6 ${isDarkMode
                    ? "text-[#D0CCC4] hover:bg-[#D0CCC4] hover:text-black"
                    : "text-[#4A4947] hover:bg-[#f0eee9]"
                    }`}
                >
                  Chat with Notes
                </Link>
                <div className={`border-t mx-4 ${isDarkMode ? "border-[#504E49]" : "border-[#C9C3B3]"}`} />
                <div
                  className={`group relative flex justify-between px-5 py-3 text-[1.25rem] transition-all duration-200 hover:pl-6 cursor-not-allowed ${isDarkMode
                    ? "text-[#D0CCC4] hover:bg-[#D0CCC4] hover:text-black"
                    : "text-[#4A4947] hover:bg-[#f0eee9]"
                    }`}
                >
                  <div className="flex items-center gap-2 blur-[0.5px]">
                    Notes Summarizer
                  </div>

                  <div className="absolute invisible group-hover:visible bg-black/80 text-white text-sm rounded-md py-1 px-2 bottom-full mb-1 right-0 whitespace-nowrap">
                    Coming soon
                  </div>
                </div>

                
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          onClick={() => router.push("/pricing")}
          className={`${montserrat500.className} text-[1.5rem] cursor-pointer ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}
        >
          Pricing
        </div>

        <div
          onClick={() => router.push("/history")}
          className={`${montserrat500.className} text-[1.5rem] cursor-pointer ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}
        >
          History
        </div>

        <div className="flex items-center gap-6">
          {mounted && (
            <button
              onClick={() => (isDarkMode ? setTheme("light") : setTheme("dark"))}
              className={`flex items-center justify-center w-10 h-10 rounded-[0.625rem] border-2 relative overflow-hidden cursor-pointer ${isDarkMode ? "border-[#D0CCC4]" : "border-[#4A4947]"
                }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isDarkMode ? "moon" : "sun"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute"
                >
                  {isDarkMode ? (
                    <Moon size={20} color="#D0CCC4" strokeWidth={3} />
                  ) : (
                    <Sun size={20} color="#4A4947" strokeWidth={3} />
                  )}
                </motion.div>
              </AnimatePresence>
            </button>
          )}
          <div className="flex items-center gap-6">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <Image
                    src={user.photoURL || "/default-avatar.png"}
                    alt="User Avatar"
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  {dropdownOpen ? (
                    <ChevronUp size={16} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} />
                  ) : (
                    <ChevronDown size={16} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} />
                  )}
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      ref={setDropdownRef}
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className={`absolute top-[3.5rem] right-0 backdrop-blur-md border rounded-2xl shadow-2xl py-3 w-60 z-50 flex flex-col overflow-hidden ${isDarkMode
                        ? "bg-[#3A3935]/70 border-[#504E49]"
                        : "bg-white/70 border-[#C9C3B3]"
                        }`}
                    >
                      <Link
                        href="/profile"
                        className={`px-5 py-3 text-[1.25rem] transition-all duration-200 hover:pl-6 ${isDarkMode
                          ? "text-[#D0CCC4] hover:bg-[#D0CCC4] hover:text-black"
                          : "text-[#4A4947] hover:bg-[#f0eee9]"
                          }`}
                      >
                        Profile
                      </Link>
                      <div className={`border-t mx-4 ${isDarkMode ? "border-[#504E49]" : "border-[#C9C3B3]"}`} />
                      <button
                        onClick={handleSignOut}
                        className={`text-left w-full px-5 py-3 text-red-600 text-[1.25rem] cursor-pointer transition-all duration-200 hover:pl-6 ${isDarkMode ? "hover:bg-red-900/30" : "hover:bg-red-50"
                          }`}
                      >
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth")}
                className={`border cursor-pointer rounded-xl px-4 py-2 text-[1.1rem] ${montserrat500.className} ${isDarkMode ? "text-[#D0CCC4] border-[#D0CCC4]" : "text-[#4A4947] border-[#4A4947]"
                  }`}
              >
                Login / Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex lg:hidden items-center gap-3">
        {mounted && (
          <button
            onClick={() => (isDarkMode ? setTheme("light") : setTheme("dark"))}
            className={`flex items-center justify-center w-9 h-9 rounded-[0.5rem] border-2 relative overflow-hidden cursor-pointer ${isDarkMode ? "border-[#D0CCC4]" : "border-[#4A4947]"
              }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isDarkMode ? "moon" : "sun"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute"
              >
                {isDarkMode ? (
                  <Moon size={18} color="#D0CCC4" strokeWidth={3} />
                ) : (
                  <Sun size={18} color="#4A4947" strokeWidth={3} />
                )}
              </motion.div>
            </AnimatePresence>
          </button>
        )}

        {user && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center cursor-pointer"
            >
              <Image
                src={user.photoURL || "/default-avatar.png"}
                alt="User Avatar"
                width={36}
                height={36}
                className="rounded-full"
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  ref={setDropdownRef}
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute top-[3.5rem] right-0 backdrop-blur-md border rounded-2xl shadow-2xl py-3 w-60 z-50 flex flex-col overflow-hidden ${isDarkMode
                    ? "bg-[#3A3935]/70 border-[#504E49]"
                    : "bg-white/70 border-[#C9C3B3]"
                    }`}
                >
                  <Link
                    href="/profile"
                    className={`px-5 py-3 text-[1.25rem] transition-all duration-200 hover:pl-6 ${isDarkMode
                      ? "text-[#D0CCC4] hover:bg-[#D0CCC4] hover:text-black"
                      : "text-[#4A4947] hover:bg-[#f0eee9]"
                      }`}
                  >
                    Profile
                  </Link>
                  <div className={`border-t mx-4 ${isDarkMode ? "border-[#504E49]" : "border-[#C9C3B3]"}`} />
                  <button
                    onClick={handleSignOut}
                    className={`text-left w-full px-5 py-3 text-red-600 text-[1.25rem] cursor-pointer transition-all duration-200 hover:pl-6 ${isDarkMode ? "hover:bg-red-900/30" : "hover:bg-red-50"
                      }`}
                  >
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex items-center justify-center w-9 h-9 rounded-[0.5rem] border-2 relative overflow-hidden cursor-pointer ${isDarkMode ? "border-[#D0CCC4]" : "border-[#4A4947]"
            }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={menuOpen ? "close" : "menu"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute"
            >
              {menuOpen ? (
                <X size={18} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} strokeWidth={3} />
              ) : (
                <Menu size={18} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} strokeWidth={3} />
              )}
            </motion.div>
          </AnimatePresence>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`fixed inset-0 top-[5.5rem] backdrop-blur-sm z-40 flex flex-col ${isMobile ? "" : "lg:hidden"}${isDarkMode ? "bg-[#3A3935]/95" : "bg-[#D8D2C2]/95"
              }`}
          >
            <div className="flex flex-col items-center pt-8 pb-6 px-6 gap-6 overflow-y-auto">
              <div className="w-full">
                <button
                  onClick={() => setServicesDropdown(!servicesDropdown)}
                  className={`${montserrat500.className} w-full py-4 text-[1.5rem] flex items-center justify-between cursor-pointer border-b ${isDarkMode
                    ? "text-[#D0CCC4] border-[#504E49]/50"
                    : "text-[#4A4947] border-[#4A4947]/30"
                    }`}
                >
                  <span>Services</span>
                  {servicesDropdown ? (
                    <ChevronUp size={24} strokeWidth={2} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} />
                  ) : (
                    <ChevronDown size={24} strokeWidth={2} className={isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} />
                  )}
                </button>

                <AnimatePresence>
                  {servicesDropdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col pl-4 py-2">
                        <Link
                          href="/generate"
                          className={`py-3 text-[1.25rem] ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}
                        >
                          Notes Generator
                        </Link>
                        <Link
                          href="/chat"
                          className={`py-3 text-[1.25rem] ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}
                        >
                          Chat with Notes
                        </Link>
                        <div className={`group relative flex justify-between py-3 text-[1.25rem] cursor-not-allowed ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"}`}>
                          <div className="flex items-center gap-2 blur-[0.5px]">
                            Notes Summarizer
                            <span className={`text-xs text-black px-2 py-0.5 rounded-full ${isDarkMode ? "bg-[#D0CCC4]" : "bg-[#FAF7F0] text-[#4A4947]"}`}>
                              Coming Soon
                            </span>

                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                href="/pricing"
                className={`${montserrat500.className} w-full py-4 text-[1.5rem] border-b ${isDarkMode
                  ? "text-[#D0CCC4] border-[#504E49]/50"
                  : "text-[#4A4947] border-[#4A4947]/30"
                  }`}
              >
                Pricing
              </Link>

              <Link
                href="/history"
                className={`${montserrat500.className} w-full py-4 text-[1.5rem] border-b ${isDarkMode
                  ? "text-[#D0CCC4] border-[#504E49]/50"
                  : "text-[#4A4947] border-[#4A4947]/30"
                  }`}
              >
                History
              </Link>

              {!user && (
                <Link
                  href="/auth"
                  className={`mt-4 w-full text-center border-2 rounded-xl px-4 py-3 text-[1.2rem] ${isDarkMode
                    ? "text-[#D0CCC4] border-[#D0CCC4]"
                    : "text-[#4A4947] border-[#4A4947]"
                    }`}
                >
                  Login / Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Navbar;