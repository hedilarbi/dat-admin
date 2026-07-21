import type { Metadata } from "next";
import { Barlow, Saira_Condensed } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./components/LayoutWrapper";
import LayoutWrapper from "./components/LayoutWrapper";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});

const sairaCondensed = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-saira-condensed",
});

export const metadata: Metadata = {
  title: "Admin DealAutoPro",
  description: "Console d'administration DealAutoPro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${barlow.variable} ${sairaCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-white">
        <UserProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </UserProvider>
      </body>
    </html>
  );
}

