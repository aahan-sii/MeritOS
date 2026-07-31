import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans, Lora } from "next/font/google";
import "./globals.css";
import "./meritos.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeritOS · Your verified application profile",
  description:
    "Build a verified personal profile, strengthen your target fit, and use evidence-backed answers on real application forms.",
  openGraph: {
    title: "MeritOS · Your verified application profile",
    description:
      "Turn verified experience into stronger, traceable application answers—without invented claims or automatic submission.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1736,
        height: 909,
        alt: "MeritOS verified profile and Chrome application assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MeritOS · Your verified application profile",
    description:
      "Build a verified profile, improve your target fit, and use it on real application forms.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/meritos-mark-v2.png",
    shortcut: "/meritos-mark-v2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${dmSans.variable} ${lora.variable}`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
