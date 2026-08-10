import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generate Notes - PandaPrep",
  description: "Create comprehensive study notes with PandaPrep's AI. Customize your notes with different formats, education levels, and reference materials.",
  keywords: "AI notes generator, study notes, learning materials, note generation, education tools",
  openGraph: {
    title: "Generate Notes - PandaPrep",
    description: "Create comprehensive study notes with PandaPrep's AI. Customize your notes with different formats and education levels.",
    type: "website",
  }
};

export default function GenerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 