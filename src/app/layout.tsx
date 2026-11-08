import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { SezsecToaster } from "@sezsec/ui";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shabab Ul Eidiz Zahabi • Secunderabad",
  description:
    "SEZ Secunderabad Members, Contributions, Floor Attendance, Miqaat Calendar & Jaman Portal.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon-32x32.png",
    apple: "/apple-icon-180x180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${cormorant.variable}`}
    >
      <body className="min-h-screen antialiased">
        {children}
        <SezsecToaster />
      </body>
    </html>
  );
}
