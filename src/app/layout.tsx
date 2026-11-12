import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { AppRuntime } from "@/components/app-runtime";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Natal a Dois",
  description: "O nosso calendário do advento com jogos — um desafio por dia até ao Natal.",
  applicationName: "Natal a Dois",
  appleWebApp: { capable: true, title: "Natal a Dois", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1d16",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${fredoka.variable} ${nunito.variable} antialiased`}>
      <body>
        <div className="snow-layer slow" aria-hidden />
        <div className="snow-layer" aria-hidden />
        <div className="relative z-10">{children}</div>
        <PwaRegister />
        <AppRuntime />
      </body>
    </html>
  );
}
