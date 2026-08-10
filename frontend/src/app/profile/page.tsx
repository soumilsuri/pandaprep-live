"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { Country } from "country-state-city";
import Navbar from "@/components/global/navbar";
import { montserrat500 } from "@/lib/font-utils";
import { ChevronDown, Save, Loader2, CreditCard } from "lucide-react";
import {
  getAuth,
  onAuthStateChanged,
  updateProfile,
  User,
} from "firebase/auth";
import app from "@/firebase/firebaseconfig";
import { useRouter } from "next/navigation";
import axios from "axios";
import { BASE_URL } from "@/lib/constant";
import Image from "next/image";
import { toast } from "sonner";

interface CountryOption {
  label: string;
  value: string;
}

interface FormData {
  fullName: string;
  gender: string;
  country: string;
  address: string;
}

const languages: string[] = [
  "English",
  "Spanish",
  "French",
  "German",
  "Chinese",
  "Japanese",
  "Korean",
  "Russian",
  "Arabic",
  "Hindi",
  "Portuguese",
  "Bengali",
  "Italian",
  "Dutch",
  "Turkish",
  "Polish",
  "Ukrainian",
  "Persian",
  "Swedish",
  "Vietnamese",
  "Thai",
  "Czech",
  "Greek",
  "Finnish",
  "Romanian",
  "Hungarian",
  "Hebrew",
  "Danish",
  "Norwegian",
  "Indonesian",
  "Malay",
  "Filipino",
  "Swahili",
];

const genders: string[] = ["Male", "Female", "Non-binary", "Prefer not to say"];

const Profile = () => {
  const auth = getAuth(app);
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const countries: CountryOption[] = useMemo(() => {
    return Country.getAllCountries().map((country) => ({
      label: country.name,
      value: country.isoCode,
    }));
  }, []);

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    gender: "",
    country: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState({
    gender: false,
    country: false,
    language: false,
  });
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<any>(null);

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth");
      } else {
        const token = await user.getIdToken();
        setIdToken(token);
        setAuthUser(user);
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const handleGetUser = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/user/get`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      setUser(response.data);
      setFormData({
        fullName: response.data.fullName || "",
        gender: response.data.gender || "",
        country: response.data.country || "",
        address: response.data.address || "",
      });
    } catch (error: any) {
      console.error("Internal Server Error:", error);
    }
  };

  useEffect(() => {
    if (idToken) {
      handleGetUser();
    }
  }, [idToken]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDropdownSelect = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setShowDropdown((prev) => ({
      ...prev,
      [field]: false,
    }));
  };

  const toggleDropdown = (dropdown: string) => {
    if (!editMode) return; // Prevent dropdown toggle if not in edit mode

    setShowDropdown((prev) => ({
      ...prev,
      [dropdown]: !prev[dropdown as keyof typeof prev],
    }));
  };

  const saveProfile = async () => {
    if (!authUser) return;

    setSaving(true);
    try {
      if (formData.fullName !== authUser.displayName) {
        await updateProfile(authUser, {
          displayName: formData.fullName,
        });
      }

      await axios.post(
        `${BASE_URL}/user/update`,
        {
          email: authUser.email,
          ...formData,
        },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      toast.success("Profile updated successfully");
      setEditMode(false); // Exit edit mode after successful save
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const navigateToSubscription = () => {
    router.push('/pricing');
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${isDarkMode
          ? "bg-neutral-950 text-green-600"
          : "bg-white text-gray-900"
          } ${montserrat500.className}`}
      >
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }

  return (
    <main
      className={`min-h-screen ${montserrat500.className} ${
        isDarkMode
          ? "bg-[#1E1D1B] text-[#D0CCC4]"
          : "bg-[#FAF7F0] text-[#4A4947]"
      } transition-colors duration-300 pb-20`}
    >
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <div className={`h-40 sm:h-56 rounded-lg overflow-hidden`}></div>

          <div
            className={`rounded-lg ${
              isDarkMode ? "bg-[#252320]" : "bg-[#FAF7F0]"
            } border ${
              isDarkMode ? "border-[#333230]" : "border-[#B17457]"
            } p-4 flex flex-col sm:flex-row items-center justify-between absolute bottom-0 left-0 transform translate-y-1/2 sm:translate-y-1/3 px-4 sm:px-8 w-full transition-colors duration-300 shadow-lg`}
          >
            <div className="relative">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden`}>
                {user?.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center text-2xl font-bold ${
                      isDarkMode ? "bg-[#D29C7B]" : "bg-[#B17457]"
                    } text-white transition-colors duration-300`}
                  >
                    {formData.fullName?.charAt(0) ||
                      user?.displayName?.charAt(0) ||
                      "U"}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 sm:mt-0 sm:ml-4 flex-grow">
              <div className="flex flex-col sm:flex-row justify-between items-center w-full">
                <div>
                  <h1 className={`text-xl sm:text-2xl font-bold ${montserrat500.className} ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} transition-colors duration-300`}>
                    {formData.fullName || user?.displayName || "User"}
                  </h1>
                  <p className={`text-sm ${isDarkMode ? "text-[#A9A29A]" : "text-gray-500"} transition-colors duration-300`}>
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (editMode) {
                      saveProfile();
                    } else {
                      setEditMode(true);
                    }
                  }}
                  disabled={saving}
                  className={`mt-2 cursor-pointer sm:mt-0 px-6 py-2 border-2 rounded-md flex items-center transition-colors duration-300 ${
                    isDarkMode
                      ? "border-[#D29C7B] text-[#D29C7B] hover:bg-[#D29C7B] hover:text-[#1E1D1B]"
                      : "border-[#B17457] text-[#B17457] hover:bg-[#B17457] hover:text-[#FAF7F0]"
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      {editMode ? (
                        <>
                          <Save size={18} className="mr-2" />
                          <span>Save Changes</span>
                        </>
                      ) : (
                        <span>Edit</span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Credits Section */}
        <div className="mt-24 sm:mt-28 mb-8">
          <div
            className={`p-6 rounded-lg border shadow-md transition-colors duration-300 ${
              isDarkMode
                ? "bg-[#252320] border-[#333230]"
                : "bg-[#FAF7F0] border-[#B17457]"
            }`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h2 className={`text-lg font-medium mb-2 flex items-center ${montserrat500.className} ${isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"} transition-colors duration-300`}>
                  <CreditCard className={`mr-2 ${isDarkMode ? "text-[#D29C7B]" : ""}`} size={20} />
                  Available Credits
                </h2>
                <p
                  className={`text-3xl font-bold transition-colors duration-300 ${
                    isDarkMode ? "text-[#D29C7B]" : "text-[#4A4947]"
                  }`}
                >
                  {user?.subscription?.credits || 0}{" "}
                  <span className={`${isDarkMode ? "text-[#A9A29A]" : ""} text-lg`}>
                    {user?.subscription?.plan === "free" && "(Trial Credits)"}
                  </span>
                </p>
              </div>
              <button
                onClick={navigateToSubscription}
                className={`mt-4 sm:mt-0 px-6 py-2 rounded-md border-2 flex items-center transition-colors duration-300 ${
                  isDarkMode
                    ? "border-[#D29C7B] text-[#D29C7B] hover:bg-[#D29C7B] hover:text-[#1E1D1B]"
                    : "border-[#B17457] text-[#B17457] hover:bg-[#B17457] hover:text-[#FAF7F0]"
                } cursor-pointer`}
              >
                Top Up Credits
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-[#A9A29A]" : ""} transition-colors duration-300`}>
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName || user?.displayName || ""}
                readOnly
                placeholder="Your Full Name"
                className={`w-full p-3 rounded-md cursor-not-allowed transition-colors duration-300 ${
                  !editMode ? "opacity-70" : ""
                } ${
                  isDarkMode
                    ? "bg-[#333230] border border-[#444340] text-[#A9A29A]"
                    : "bg-gray-100 border border-gray-300 text-gray-500"
                } focus:outline-none`}
              />
            </div>

            <div className="relative">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-[#A9A29A]" : ""} transition-colors duration-300`}>
                Gender
              </label>
              <div
                onClick={() => toggleDropdown("gender")}
                className={`w-full p-3 rounded-md flex justify-between items-center transition-colors duration-300 ${
                  editMode ? "cursor-pointer" : "cursor-not-allowed"
                } ${
                  isDarkMode
                    ? `bg-[#333230] border border-[#444340] ${!editMode ? "opacity-70" : ""}`
                    : `${editMode ? "bg-white" : "bg-gray-100"} border border-gray-300`
                }`}
              >
                <span className={`${formData.gender ? "" : "text-gray-500"} ${isDarkMode && formData.gender ? "text-[#D0CCC4]" : ""}`}>
                  {formData.gender || "Select Gender"}
                </span>
                <ChevronDown
                  size={18}
                  className={`${isDarkMode ? "text-[#A9A29A]" : "text-gray-500"} ${!editMode ? "opacity-50" : ""}`}
                />
              </div>

              {showDropdown.gender && editMode && (
                <div
                  className={`absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md shadow-lg transition-colors duration-300 ${
                    isDarkMode
                      ? "bg-[#333230] border border-[#444340]"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  {genders.map((option) => (
                    <div
                      key={option}
                      onClick={() => handleDropdownSelect("gender", option)}
                      className={`px-4 py-2 cursor-pointer transition-colors duration-300 ${
                        isDarkMode
                          ? `hover:bg-[#444340] text-[#D0CCC4] ${formData.gender === option ? "bg-[#444340]" : ""}`
                          : `hover:bg-gray-100 ${formData.gender === option ? "bg-gray-100" : ""}`
                      }`}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-[#A9A29A]" : ""} transition-colors duration-300`}>
                  Country
                </label>
                <div
                  onClick={() => toggleDropdown("country")}
                  className={`w-full p-3 rounded-md flex justify-between items-center transition-colors duration-300 ${
                    editMode ? "cursor-pointer" : "cursor-not-allowed"
                  } ${
                    isDarkMode
                      ? `bg-[#333230] border border-[#444340] ${!editMode ? "opacity-70" : ""}`
                      : `${editMode ? "bg-white" : "bg-gray-100"} border border-gray-300`
                  }`}
                >
                  <span className={`${formData.country ? "" : "text-gray-500"} ${isDarkMode && formData.country ? "text-[#D0CCC4]" : ""}`}>
                    {formData.country || "Select Country"}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`${isDarkMode ? "text-[#A9A29A]" : "text-gray-500"} ${!editMode ? "opacity-50" : ""}`}
                  />
                </div>

                {showDropdown.country && editMode && (
                  <div
                    className={`absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md shadow-lg transition-colors duration-300 ${
                      isDarkMode
                        ? "bg-[#333230] border border-[#444340]"
                        : "bg-white border border-gray-200"
                    }`}
                  >
                    {countries.map((country) => (
                      <div
                        key={country.value}
                        onClick={() =>
                          handleDropdownSelect("country", country.label)
                        }
                        className={`px-4 py-2 cursor-pointer transition-colors duration-300 ${
                          isDarkMode
                            ? `hover:bg-[#444340] text-[#D0CCC4] ${formData.country === country.label ? "bg-[#444340]" : ""}`
                            : `hover:bg-gray-100 ${formData.country === country.label ? "bg-gray-100" : ""}`
                        }`}
                      >
                        {country.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-[#A9A29A]" : ""} transition-colors duration-300`}>
                  Billing Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address || ""}
                  onChange={handleInputChange}
                  placeholder="Enter your billing address"
                  disabled={!editMode}
                  className={`w-full p-3 rounded-md transition-colors duration-300 ${
                    isDarkMode
                      ? `bg-[#333230] border border-[#444340] ${editMode ? "text-[#D0CCC4]" : "text-[#A9A29A]"} ${!editMode ? "opacity-70 cursor-not-allowed" : ""}`
                      : `${editMode ? "bg-white" : "bg-gray-100"} border border-gray-300 ${editMode ? "text-gray-900" : "text-gray-500"} ${!editMode ? "cursor-not-allowed" : ""}`
                  } focus:outline-none`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Profile;