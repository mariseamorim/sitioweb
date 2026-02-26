import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { UserProvider } from "@/contexts/UserContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SítioWeb - Controle de Animais",
  description: "Sistema de cadastro e controle de animais para sítios e fazendas",
};

export const viewport = {
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${geistSans.variable} antialiased bg-gray-50 min-h-screen`}>
        <UserProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7 pb-24 md:pb-7">
            {children}
          </main>
        </UserProvider>
      </body>
    </html>
  );
}
