import React, { useEffect, useState } from "react";

type AnimatedInputProps = {
  formDataValue: string;
  handleInputChange: (field: string, value: string) => void;
  fieldKey: string;
  placeholders: string[];
  inputProps?: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;
  textarea: boolean;
  className?: string;
};

const AnimatedInput: React.FC<AnimatedInputProps> = ({
  formDataValue,
  handleInputChange,
  fieldKey,
  placeholders,
  inputProps = {},
  textarea = false,
  className = "",
}) => {
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholders[0]);
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderOpacity(0);

      setTimeout(() => {
        const nextIndex = (currentPlaceholderIndex + 1) % placeholders.length;
        setCurrentPlaceholderIndex(nextIndex);
        setCurrentPlaceholder(placeholders[nextIndex]);
        setPlaceholderOpacity(1);
      }, 500);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentPlaceholderIndex, placeholders]);

  return (
    <div className="relative">
      {textarea ? (
        <textarea
          value={formDataValue}
          onChange={(e) => handleInputChange(fieldKey, e.target.value)}
          className={`w-full h-24 sm:h-32 border px-3 sm:px-4 py-2 text-sm sm:text-base resize-none border-gray-500 rounded-md transition-all ${className} focus:outline-none`}
          style={{ transition: "all 0.3s ease" }}
          {...inputProps}
        />
      ) : (
        <input
          type="text"
          value={formDataValue}
          onChange={(e) => handleInputChange(fieldKey, e.target.value)}
          className={`w-full px-3 sm:px-4 py-2 sm:py-2 text-sm sm:text-base border border-gray-500 rounded-md transition-all ${className} focus:outline-none`}
          style={{ transition: "all 0.3s ease" }}
          {...inputProps}
        />
      )}
      
      {!formDataValue && (
        <div
          className="absolute inset-y-0 left-0 flex pt-2 px-3 sm:px-4 pointer-events-none text-gray-400 text-sm sm:text-base"
          style={{
            opacity: placeholderOpacity,
            transition: "opacity 0.5s ease",
          }}
        >
          {currentPlaceholder}
        </div>
      )}
    </div>
  );
};

export default AnimatedInput;