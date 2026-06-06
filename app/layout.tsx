import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `CivicSecondBrain — ${process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz"}, ${process.env.NEXT_PUBLIC_CITY_STATE ?? "TX"}`,
  description: `AI-powered city knowledge base for the ${process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz"} City Council`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Inline script: read localStorage before first paint to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.className} h-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100`}
      >
        <div className="flex h-full">
          <Sidebar />
          {/* pt-14 on mobile offsets the fixed top header bar; md:pt-0 removes it on desktop */}
          <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
