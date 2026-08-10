import { montserrat500 } from "@/lib/font-utils";
import { Lock, Info } from "lucide-react";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";

interface TabProps {
  label: string;
  value: string;
}

interface MultiTabSwitchProps {
  tabs: TabProps[];
  lgSize?: boolean;
  premium_feature?: string[];
  handleChange: (field: string, value: string) => void;
  field: string;
  userCredits: number;
  value?: string;
}

const MultiTabSwitch: React.FC<MultiTabSwitchProps> = ({
  tabs,
  lgSize,
  premium_feature,
  handleChange,
  field,
  userCredits,
  value,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    value || tabs[0].value
  );
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (value !== undefined) {
      setSelectedOption(value);
    }
  }, [value]);

  return (
    <div className="w-full flex flex-col items-start gap-1 sm:gap-2 relative">
      {field === "include_images" && (
        <div className="flex items-center ml-1 sm:ml-2 gap-1">
          <div className="relative group">
            <Info
              size={14}
              className={`${
                isDarkMode ? "text-white" : "text-gray-500"
              } cursor-pointer mt-0.5 sm:w-4 sm:h-4`}
            />
            <div className="absolute invisible group-hover:visible bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-[#ECFDF4] text-[#4A5565] text-xs px-2 py-1 sm:px-3 sm:py-1 rounded-md shadow-md z-50 w-max">
              This is an Experimental Feature.
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap w-full gap-1 sm:gap-2">
        {tabs.map((option) => {
          const isPremium = premium_feature?.includes(option.value);
          const isDisabled = isPremium && userCredits === 0;

          return (
            <div key={option.value} className="relative group flex-1 min-w-[80px] sm:min-w-[100px]">
              <button
                className={`w-full px-2 sm:px-6 py-1 sm:py-2 transition duration-300 rounded-lg border-2 border-[#B17457] cursor-pointer
                  ${
                    selectedOption === option.value
                      ? "bg-[#B17457] text-white"
                      : "bg-white text-black"
                  } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}
                `}
                onClick={() => {
                  if (!isDisabled) {
                    setSelectedOption(option.value);
                    handleChange(field, option.value);
                  }
                }}
                disabled={isDisabled}
              >
                <div
                  className={`flex justify-center items-center gap-1 sm:gap-2 ${montserrat500.className} text-[12px] sm:text-xl`}
                >
                  <p>{option.label}</p>
                  {isPremium && userCredits === 0 && <Lock size={12} className="sm:w-4 sm:h-4" />}
                </div>
              </button>
              {isDisabled && (
                <div className="absolute invisible group-hover:visible bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-[#F3EFE5] text-[#4A5565] text-xs px-2 py-1 sm:px-3 sm:py-1 rounded-md shadow-md z-50 w-max">
                  You have 0 credits left.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultiTabSwitch;