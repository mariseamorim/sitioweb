import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PwaRegistration } from '@/components/PwaRegistration';
import { AppShell } from "@/components/AppShell";
import { UserProvider } from "@/contexts/UserContext";
import { DialogProvider } from "@/components/DialogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Anota Aí Agro",
  icons: { icon: "/anota-ai-agro-icon-192.png", apple: "/anota-ai-agro-icon-180.png" },
  appleWebApp: { capable: true, title: "Anota Aí Agro" },
  title: "Anota Aí Agro — Gestão Rural",
  description: "Gestão de rebanho, produção de leite, finanças e estoque para sítios e fazendas",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#18543d",
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
        <PwaRegistration />
        <UserProvider>
          <DialogProvider>
            <AppShell>{children}</AppShell>
          </DialogProvider>
        </UserProvider>
      </body>
    </html>
  );
}
