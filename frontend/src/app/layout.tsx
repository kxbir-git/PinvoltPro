import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PinVault Pro — Pinterest Video Downloader | Download Pinterest Videos & Reels in HD",
  description: "Free and high-speed Pinterest Video Downloader. Download Pinterest videos, Reels, Idea Pins, and GIFs in 1080p Full HD with sound. No watermark, 100% free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
