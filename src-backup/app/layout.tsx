import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyOS — Your Personal Virtual OS",
  description: "MyOS is a web-based Virtual Operating System that becomes yours. Enter your name and the entire OS rebrands to you.",
  keywords: ["MyOS", "Virtual OS", "Terminal", "Web OS", "Personal OS"],
  authors: [{ name: "MyOS" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "MyOS — Your Personal Virtual OS",
    description: "A web-based Virtual OS that becomes yours. Enter your name and it becomes [YourName]OS!",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
