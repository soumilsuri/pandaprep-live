"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/global/navbar";
import { cn, getCookie } from "@/lib/utils";
import { Eye, Info, Search, Trash2, Pencil, Save, X, MessageCircle } from "lucide-react";
import axios from "axios";
import { BASE_URL } from "@/lib/constant";
import { useTheme } from "next-themes";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { montserrat500, montserrat600 } from "@/lib/font-utils";

const History = () => {
  const router = useRouter();
  const auth = getAuth();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [notes, setNotes] = useState<
    {
      id: number;
      display_name: string;
      subject_name: string;
      createdAt: string;
      secure_url: string;
      status: string;
      type: 'pdf_generation' | 'pdf_chat';
    }[]
  >([]);
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const [editNoteId, setEditNoteId] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [allSelected, setAllSelected] = useState(false);

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const isDarkMode = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const toggleSelection = (id: number) => {
    setSelectedNotes((prev) =>
      prev.includes(id) ? prev.filter((noteId) => noteId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedNotes([]);
    } else {
      setSelectedNotes(notes.filter((note) => note.status === 'completed').map((note) => note.id));
    }
    setAllSelected(!allSelected);
  };

  const handleGetAllNotes = async () => {
    try {
      const email = user?.email || getCookie("email");
      if (!idToken || !email) return;
      const response = await axios.post(
        `${BASE_URL}/userHistory/notes`,
        { email },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      setNotes(response.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const StatusTag = ({ status }: { status: string }) => {
    const statusStyles = {
      completed: {
        label: "Completed",
        color: "bg-green-500 text-white",
      },
      processing: {
        label: "Processing",
        color: "bg-yellow-500 text-white",
      },
      queued: {
        label: "In Queue",
        color: "bg-orange-500 text-white",
      }
    };

    type StatusKey = keyof typeof statusStyles;

    const tag =
      status in statusStyles
        ? statusStyles[status as StatusKey]
        : {
            label: status,
            color: "bg-gray-400 text-white",
          };

    return (
      <span
        className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full",
          montserrat500.className,
          tag.color
        )}
      >
        {tag.label}
      </span>
    );
  };

  const TypeTag = ({ type }: { type: 'pdf_generation' | 'pdf_chat' }) => {
    const typeStyles = {
      pdf_generation: {
        label: "Notes Generation",
        color: "bg-blue-500 text-white",
      },
      pdf_chat: {
        label: "Chat with Notes",
        color: "bg-purple-500 text-white",
      }
    };

    const tag = typeStyles[type];

    return (
      <span
        className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full ",
          montserrat500.className,
          tag.color
        )}
      >
        {tag.label}
      </span>
    );
  };

  const handleRenameNote = async (id: number) => {
    try {
      const email = user?.email || getCookie("email");
      if (!idToken || !email || !editDisplayName.trim()) return;

      await axios.post(
        `${BASE_URL}/userHistory/notes/rename`,
        {
          _id: id,
          display_name: editDisplayName.trim(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      setEditNoteId(null);
      setEditDisplayName("");
      handleGetAllNotes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteNote = async (ids: number[]) => {
    try {
      const email = user?.email || getCookie("email");
      if (!idToken || !email) return;
      await axios.post(
        `${BASE_URL}/userHistory/notes/delete`,
        {
          email,
          requestId: ids,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      setSelectedNotes([]);
      handleGetAllNotes();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (idToken) {
      handleGetAllNotes();
    }
  }, [idToken]);

  useEffect(() => {
    const completedNotes = notes.filter((note) => note.status === 'completed');
    setAllSelected(selectedNotes.length === completedNotes.length && completedNotes.length > 0);
  }, [selectedNotes, notes]);

  // Get display name or fall back to subject_name if display_name is missing
  const getNoteName = (note: {
    display_name: string;
    subject_name: string;
  }) => {
    return note.display_name || note.subject_name;
  };

  const filteredNotes = notes.filter((note) =>
    getNoteName(note).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinueChat = (note: any) => {
    if (note.type === 'pdf_chat') {
      router.push(`/chat?historyId=${note.id}`);
    }
  };

  if (!mounted) return <div className="min-h-screen" />;

  return (
    <main
      className={cn(
        "min-h-screen flex flex-col items-center overflow-x-hidden",
        isDarkMode
          ? "bg-[#1E1D1B] text-[#FAF7F0]"
          : "bg-[#FAF7F0] text-[#4A4947]"
      )}
    >
      <Navbar />

      <section className="w-full max-w-3xl px-4 sm:px-6 flex flex-col items-center pt-16 sm:pt-20 md:pt-24">
        <div className="w-full z-10 pt-6 pb-4 bg-inherit">
          <div className="flex items-center justify-center w-full">
            <h1
              className={cn(
                "text-2xl sm:text-3xl md:text-5xl text-center",
                montserrat600.className,
                isDarkMode ? "text-[#D29C7B]" : "text-[#4A4947]"
              )}
            >
              History
            </h1>
          </div>
          <div className="relative mt-4 w-full">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search
                className={cn(
                  "h-5 w-5",
                  isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
                )}
              />
            </div>
            <input
              type="text"
              placeholder="Search your entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2",
                montserrat500.className,
                isDarkMode
                  ? "border-[#D29C7B] bg-neutral-900 bg-opacity-60 text-[#FAF7F0] placeholder:text-[#D0CCC4] focus:ring-[#D29C7B]"
                  : "border-[#B17457] bg-white bg-opacity-80 text-[#4A4947] placeholder:text-gray-500 focus:ring-[#B17457]"
              )}
            />
          </div>
        </div>

        <div className="w-full">
          <div
            className={cn(
              "text-sm mb-4 flex items-center gap-2 w-full",
              isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
            )}
          >
            {selectedNotes.length > 0 ? (
              <>
                <p className={montserrat500.className}>
                  {selectedNotes.length} selected
                </p>
                <button
                  onClick={() => handleDeleteNote(selectedNotes)}
                  className="text-red-500 cursor-pointer hover:text-red-400 transition-colors"
                  aria-label="Delete selected notes"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-1",
                  montserrat500.className
                )}
              >
                <p>
                  You have {notes.length} {notes.length === 1 ? "entry" : "entries"} in your PandaPrep history.
                </p>
                <div className="relative inline-block">
                  <Info
                    className={cn(
                      "h-4 w-4 cursor-help",
                      isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
                    )}
                    aria-label="Information about note retention"
                    onClick={() => setIsTooltipVisible(!isTooltipVisible)}
                    onMouseEnter={() => setIsTooltipVisible(true)}
                    onMouseLeave={() => setIsTooltipVisible(false)}
                  />
                  <div
                    className={cn(
                      "absolute z-10 transition-opacity duration-300 bottom-full -left-6 sm:left-1/2 transform -translate-x-1/2 mb-2 p-2 w-36 sm:w-56 rounded shadow-lg text-xs",
                      montserrat500.className,
                      isDarkMode
                        ? "bg-neutral-800 text-[#D0CCC4] border border-[#D29C7B]"
                        : "bg-white text-[#4A4947] border border-[#B17457]",
                      isTooltipVisible
                        ? "opacity-100 visible"
                        : "opacity-0 invisible"
                    )}
                  >
                    Notes older than 30 days will be deleted automatically.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end mb-4 gap-2">
            <input
              type="checkbox"
              id="select-all-checkbox"
              className={cn(
                "h-5 w-5 focus:ring-2 cursor-pointer",
                isDarkMode
                  ? "text-[#D29C7B] focus:ring-[#D29C7B]"
                  : "text-[#B17457] focus:ring-[#B17457]"
              )}
              checked={allSelected}
              onChange={toggleSelectAll}
            />

            <label
              htmlFor="select-all-checkbox"
              className={cn(
                "cursor-pointer",
                montserrat500.className,
                isDarkMode ? "text-[#D0CCC4]" : "text-[#4A4947]"
              )}
            >
              {!allSelected ? `Select All` : `Deselect All`}
            </label>
          </div>

          <div
            className="space-y-4 w-full overflow-y-auto px-1 pb-8"
            style={{ maxHeight: "calc(100vh - 280px)" }}
          >
            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    "flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg shadow-md transition-colors",
                    isDarkMode
                      ? "border-[#D29C7B] bg-neutral-900 hover:bg-neutral-800"
                      : "border-[#B17457] bg-white hover:bg-gray-50"
                  )}
                >
                  <div className="mb-2 sm:mb-0">
                    {editNoteId === note.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className={cn(
                            "text-sm px-2 py-1 border rounded focus:outline-none",
                            montserrat500.className,
                            isDarkMode
                              ? "bg-neutral-800 border-[#D29C7B] text-[#FAF7F0]"
                              : "bg-white border-[#B17457] text-[#4A4947]"
                          )}
                        />
                      </div>
                    ) : (
                      <h2
                        className={cn(
                          "text-base sm:text-lg font-semibold",
                          montserrat600.className,
                          isDarkMode ? "text-[#FAF7F0]" : "text-[#4A4947]"
                        )}
                      >
                        {getNoteName(note)}
                      </h2>
                    )}

                    <p
                      className={cn(
                        "text-xs sm:text-sm mt-1",
                        montserrat500.className,
                        isDarkMode ? "text-[#D0CCC4]" : "text-gray-600"
                      )}
                    >
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        {/* Only show StatusTag if type is not 'pdf_chat' */}
                        {note.type !== 'pdf_chat' && <StatusTag status={note.status} />}
                        <TypeTag type={note.type} />
                        {note.type === 'pdf_chat' && (
                          <button
                            onClick={() => handleContinueChat(note)}
                            className={cn(
                              "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                              montserrat500.className,
                              isDarkMode
                                ? "bg-purple-500 text-white hover:bg-purple-600"
                                : "bg-purple-500 text-white hover:bg-purple-600"
                            )}
                          >
                            <MessageCircle className="w-3 h-3" />
                            Continue Chat
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 items-center self-end sm:self-auto">
                    {editNoteId === note.id ? (
                      <>
                        <button
                          className="p-1 rounded-full hover:bg-opacity-20 transition-colors"
                          onClick={() => handleRenameNote(note.id)}
                          aria-label="Save renamed note"
                        >
                          <Save
                            className="cursor-pointer"
                            color={isDarkMode ? "#D0CCC4" : "#676E7B"}
                          />
                        </button>
                        <button
                          className="p-1 rounded-full hover:bg-opacity-20 transition-colors"
                          onClick={() => {
                            setEditNoteId(null);
                            setEditDisplayName("");
                          }}
                          aria-label="Cancel rename"
                        >
                          <X
                            className="cursor-pointer"
                            color={isDarkMode ? "#D0CCC4" : "#676E7B"}
                          />
                        </button>
                      </>
                    ) : (
                      <button
                        className="p-1 rounded-full hover:bg-opacity-20 transition-colors"
                        onClick={() => {
                          setEditNoteId(note.id);
                          setEditDisplayName(getNoteName(note));
                        }}
                        aria-label="Rename note"
                      >
                        <Pencil
                          className="cursor-pointer"
                          color={isDarkMode ? "#D0CCC4" : "#676E7B"}
                        />
                      </button>
                    )}

                    <button
                      className={`p-1 rounded-full hover:bg-opacity-20 transition-colors ${
                        note.status === "completed"
                          ? "cursor-pointer"
                          : "opacity-50"
                      }`}
                      onClick={() => window.open(note.secure_url, "_blank")}
                      disabled={note.status !== "completed"}
                      aria-label="View note"
                    >
                      <Eye
                        className=""
                        color={isDarkMode ? "#D0CCC4" : "#676E7B"}
                      />
                    </button>
                    <input
                      type="checkbox"
                      className={`${
                        note.status === "completed"
                          ? "cursor-pointer"
                          : ""
                      } h-5 w-5 focus:ring-2 ${
                        isDarkMode
                          ? "text-[#D29C7B] focus:ring-[#D29C7B]"
                          : "text-[#B17457] focus:ring-[#B17457]"
                      }`}
                      checked={selectedNotes.includes(note.id)}
                      onChange={() => toggleSelection(note.id)}
                      disabled={note.status !== "completed"}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div
                className={cn(
                  "text-center py-8",
                  montserrat500.className,
                  isDarkMode ? "text-[#D0CCC4]" : "text-gray-600"
                )}
              >
                No notes found matching your search.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default History;