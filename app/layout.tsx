import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Anek_Gujarati, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
// Indic faces load only when Gujarati or Hindi text appears on the page.
const anekGujarati = Anek_Gujarati({ variable: "--font-anek-gu", subsets: ["gujarati"], display: "swap", preload: false });
const anekDevanagari = Anek_Devanagari({ variable: "--font-anek-deva", subsets: ["devanagari"], display: "swap", preload: false });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Nagrik Saathi · Report civic issues in Ahmedabad",
  description: "Take a photo of a civic problem. Nagrik Saathi finds the right AMC department, files the complaint and keeps you posted.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${anekGujarati.variable} ${anekDevanagari.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] btn btn-primary">
          Skip to content
        </a>
        <Providers>
          <Nav />
          <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-4 sm:py-6">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
