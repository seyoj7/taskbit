import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./components/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taskbit · Arc-Native Tasks & Microgrants Marketplace",
  description: "Post verifiable tasks with USDC bounties. Builders complete tasks, submit proof, and get paid instantly via smart contract escrow.",
  icons: {
    icon: "/taskbit_logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("taskbit:theme");if(t==="light"){document.documentElement.classList.remove("dark");}else{document.documentElement.classList.add("dark");}}catch(e){}`,
          }}
        />
      </head>
      <body style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
