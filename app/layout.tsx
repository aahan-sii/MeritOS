import type { Metadata } from "next";
import { DM_Sans, Lora } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeritOS · Evidence-backed application intelligence",
  description:
    "Build a verified LifeGraph, complete high-stakes applications, and pressure-test your case through a transparent Review Room.",
  openGraph: {
    title: "MeritOS · Evidence-backed application intelligence",
    description:
      "Turn your verified experiences into stronger, traceable applications—without invented claims or automatic submission.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1736,
        height: 909,
        alt: "MeritOS evidence graph flowing into an application and committee review room",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MeritOS · Evidence-backed application intelligence",
    description:
      "Build a verified LifeGraph, complete applications, and pressure-test your case.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${lora.variable}`}>{children}</body>
    </html>
  );
}
