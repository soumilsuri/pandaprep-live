"use client";

declare global {
  interface Window {
    Razorpay: any;
  }
}

import Navbar from "@/components/global/navbar";
import {
  CardContainer,
  CardBody,
  CardItem,
} from "@/components/ui/pricing-card";
import { CheckIcon, XIcon, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASE_URL, PLANS } from "@/lib/constant";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import CustomerDetailsDialog, { CustomerDetailsDialogRef, Plan } from "@/components/global/user-detail-razorpay";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { montserrat600, montserrat700 } from "@/lib/font-utils";

export default function Pricing() {
  const router = useRouter();
  const auth = getAuth();

  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  const customerDialogRef = useRef<CustomerDetailsDialogRef>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check auth state and redirect if not logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth");
      } else {
        setUser(user);
        const token = await user.getIdToken();
        setIdToken(token);
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    if (idToken) {
      handleGetUser();
    }
  }, [idToken]);

  const handleGetUser = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/get`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      setUserId(res.data._id);
    } catch (error: any) {
      console.error("Internal Server Error:", error);
    }
  };

  const handlePaymentClick = (plan: Plan) => {
    if (customerDialogRef.current) {
      customerDialogRef.current.openDialog(plan);
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  if (!mounted) return <div className="min-h-screen"></div>;

  return (
    <main className={`overflow-x-hidden min-h-screen flex flex-col items-center transition-colors duration-300 ${
      isDarkMode ? "bg-[#1E1D1B] text-[#D0CCC4]" : "bg-[#FAF7F0] text-[#4A4947]"
    }`}>
      <Navbar />

      <div className="w-full max-w-6xl px-4 flex flex-col items-center">
        <h1 className={`${montserrat700.className} text-2xl sm:text-3xl md:text-4xl font-bold text-center mt-24 sm:mt-28 md:mt-36 mb-6 sm:mb-8 ${
          isDarkMode ? "text-[#D29C7B]" : "text-[#4A4947]"
        }`}>
          Get Premium Subscription at a lower price!
        </h1>

        <section className="w-full py-4 px-4 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full justify-items-center">
            {PLANS.map((plan, index) => (
              <CardContainer
                key={index}
                className="w-full max-w-xs md:max-w-none rounded-2xl p-[4px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 overflow-hidden"
              >
                <span className={`absolute inset-[-1000%] animate-[spin_2s_linear_infinite] ${
                  isDarkMode 
                    ? "bg-[conic-gradient(from_90deg_at_50%_50%,#D29C7B_0%,#9e765e_50%,#D29C7B_100%)]"
                    : "bg-[conic-gradient(from_90deg_at_50%_50%,#B17457_0%,#d3a993_50%,#B17457_100%)]"
                }`} />
                <div className={`relative w-full h-full rounded-2xl p-6 ${
                  isDarkMode ? "bg-[#2A2926]" : "bg-white"
                }`}>
                  <CardBody className="relative group/card w-full h-auto rounded-xl">
                    <CardItem
                      translateZ="50"
                      className={`${montserrat700.className} text-xl font-bold ${
                        isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
                      }`}
                    >
                      {plan.title}
                      <h2 className={`text-4xl sm:text-5xl ${
                        isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
                      }`}>
                        {plan.price}
                      </h2>
                    </CardItem>
                    <CardItem
                      translateZ="60"
                      className={`${montserrat600.className} text-sm mt-2 ${
                        isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
                      }`}
                    >
                      {plan.description}
                      <ul className="my-4 flex flex-col gap-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckIcon
                              className={
                                isDarkMode ? "text-[#D29C7B]" : "text-[#B17457]"
                              }
                            />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {plan.limitations.length > 0 && (
                        <ul className="my-4 flex flex-col gap-2">
                          {plan.limitations.map((limitation, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <XIcon
                                className={
                                  isDarkMode ? "text-red-400" : "text-red-500"
                                }
                              />
                              <span>{limitation}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardItem>
                    <div className="flex justify-center items-center mt-6">
                      <CardItem
                        translateZ={20}
                        as="button"
                        onClick={() => plan.title === "Scale" ? router.push("/contact") : handlePaymentClick(plan as Plan)}
                        className={`${montserrat700.className} w-full px-6 py-3 rounded-xl text-sm border-2 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                          isDarkMode
                            ? "bg-[#2A2926] border border-[#D29C7B] text-[#FAF7F0] hover:bg-[#9e765e] hover:border-[#D29C7B] hover:text-[#1E1D1B]"
                            : "bg-[white] border-2 border-[#B17457] text-[#B17457] hover:bg-[#B17457] hover:border-[#B17457] hover:text-[#FAF7F0]"
                        }`}
                      >
                        <p>{plan.title === "Scale" ? "Contact Us" : "Get Started"}</p>
                        <ArrowUpRight strokeWidth={3} />
                      </CardItem>
                    </div>
                  </CardBody>
                </div>
              </CardContainer>
            ))}
          </div>
        </section>
      </div>

      {idToken && userId && (
        <CustomerDetailsDialog
          ref={customerDialogRef}
          idToken={idToken}
          userId={userId}
          BASE_URL={BASE_URL}
        />
      )}
    </main>
  );
}