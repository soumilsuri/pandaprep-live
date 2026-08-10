"use client";

import Navbar from "@/components/global/navbar";
import { Funnel_Display } from "next/font/google";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const funnel_display = Funnel_Display({
  subsets: ["latin"],
  weight: "400",
});

const PrivacyPolicy = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <>
      <Navbar />

      <main
        className={cn(
          "px-4 py-10 sm:px-10 lg:px-32 transition-colors duration-300 h-full",
          funnel_display.className,
          isDark ? "bg-[#1E1D1B] text-white" : "bg-[#FAF7F0] text-[#4A4947]"
        )}
      >
        <section className="max-w-7xl mx-auto mb-20">
          <h1 className={`text-center mt-16 mb-10 text-4xl ${isDark?"text-[#B17457]":"text-[#4A4947]"}`}>
            Privacy Policy
          </h1>

          <p className={`text-sm text-center mb-10 ${isDark? "text-[#D0CCC4]":"text-gray-500 "}`}>
            Last updated on Apr 14 2025
          </p>

          <div className="space-y-10 text-base sm:text-lg leading-relaxed">
            <p>
              This privacy policy sets out how PandaPrep uses and protects any
              information that you give PandaPrep when you visit their website
              and/or agree to purchase from them.
            </p>

            <p>
              PandaPrep is committed to ensuring that your privacy is protected.
              Should we ask you to provide certain information by which you can
              be identified when using this website, then you can be assured
              that it will only be used in accordance with this privacy
              statement.
            </p>

            <p>
              PandaPrep may change this policy from time to time by updating
              this page. You should check this page from time to time to ensure
              that you adhere to these changes.
            </p>

            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              Information We May Collect
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Name</li>
              <li>Contact information including email address</li>
              <li>
                Demographic information such as postcode, preferences and
                interests, if required
              </li>
              <li>
                Other information relevant to customer surveys and/or offers
              </li>
            </ul>

            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              What We Do with the Information We Gather
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Internal record keeping.</li>
              <li>Improving our products and services.</li>
              <li>
                Sending promotional emails about new products, special offers or
                other information you may find interesting.
              </li>
              <li>
                Contacting you for market research purposes via email, phone,
                fax or mail.
              </li>
              <li>Customizing the website according to your interests.</li>
            </ul>

            <h2 className="text-xl sm:text-2xl font-bold mb-2">Security</h2>
            <p>
              We are committed to ensuring that your information is secure. In
              order to prevent unauthorised access or disclosure we have put in
              suitable measures.
            </p>

            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              How We Use Cookies
            </h2>
            <p>
              A cookie is a small file which asks permission to be placed on
              your computer&#39;s hard drive. Once you agree, the file is added
              and the cookie helps analyze web traffic or lets you know when you
              visit a particular site. Cookies allow web applications to respond
              to you as an individual by remembering your preferences.
            </p>

            <p>
              We use traffic log cookies to identify which pages are being used.
              This helps us analyze data about webpage traffic and improve our
              website. We only use this information for statistical analysis and
              then the data is removed.
            </p>

            <p>
              Overall, cookies help us provide you with a better website
              experience. A cookie in no way gives us access to your computer or
              any information about you, other than what you choose to share.
            </p>

            <p>
              You can choose to accept or decline cookies. Most web browsers
              automatically accept cookies, but you can usually modify your
              settings to decline them if you prefer. This may prevent full
              functionality of the website.
            </p>

            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              Controlling Your Personal Information
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                Whenever you are asked to fill in a form on the website, look
                for the option to opt out of direct marketing.
              </li>
              <li>
                You may withdraw consent for marketing at any time by emailing
                us at <span className="underline">tshifthappens@gmail.com</span>
                .
              </li>
              <li>
                We will not sell, distribute or lease your personal information
                to third parties unless required by law or with your permission.
              </li>
              <li>
                If you believe that any information we are holding on you is
                incorrect or incomplete, please contact us and we will promptly
                correct it.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
};

export default PrivacyPolicy;
