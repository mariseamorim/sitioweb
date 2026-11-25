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
  display: "swap",
});

const SITE_URL = "https://www.anotaaiagro.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Anota Aí Agro",
  icons: { icon: "/anota-ai-agro-icon-192.png", apple: "/anota-ai-agro-icon-180.png" },
  appleWebApp: { capable: true, title: "Anota Aí Agro" },
  title: {
    default: "Anota Aí Agro — Gestão Rural para Sítios e Fazendas",
    template: "%s | Anota Aí Agro",
  },
  description:
    "Anota Aí Agro: aplicativo e sistema web para controle de leite, rebanho, reprodução, vacinas, financeiro e estoque de sítios e fazendas, com funcionamento offline.",
  keywords: [
    "Anota Aí Agro",
    "anotaaiagro",
    "Anota Aí Leite",
    "gestão rural",
    "controle de leite",
    "controle de rebanho",
    "pecuária leiteira",
    "aplicativo fazenda offline",
    "sistema para sítio e fazenda",
  ],
  authors: [{ name: "Anota Aí Agro", url: SITE_URL }],
  creator: "Anota Aí Agro",
  publisher: "Anota Aí Agro",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Anota Aí Agro",
    title: "Anota Aí Agro — Gestão Rural para Sítios e Fazendas",
    description:
      "Controle produção de leite, rebanho, vacinas, reprodução, financeiro e estoque do seu sítio ou fazenda, mesmo sem internet.",
    images: [
      {
        url: "/rural-hero.png",
        width: 1200,
        height: 630,
        alt: "Anota Aí Agro — Gestão Rural para Sítios e Fazendas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anota Aí Agro — Gestão Rural para Sítios e Fazendas",
    description:
      "Controle produção de leite, rebanho, vacinas, reprodução, financeiro e estoque do seu sítio ou fazenda, mesmo sem internet.",
    images: ["/rural-hero.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
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
        {/* Dentro do app Android (WebView do Capacitor) a tela vai até embaixo da barra de status. A classe "app-android"
            liga as regras de margem em globals.css. Script inline para valer antes da primeira pintura. O identificador
            "AnotaAiAgro/Android" é definido em capacitor.config.ts. */}
        <script dangerouslySetInnerHTML={{ __html: "if(navigator.userAgent.indexOf('AnotaAiAgro/Android')!==-1)document.documentElement.className+=' app-android'" }} />
        <script dangerouslySetInnerHTML={{ __html: "try{var l=localStorage.getItem('lang')||(navigator.language||'').slice(0,2);if(l==='es')document.documentElement.lang='es'}catch(e){}" }} />
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
