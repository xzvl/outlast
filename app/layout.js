import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk"
});

export const metadata = {
  title: "ROOC Auction Roulette Viewer",
  description: "Live Google Sheets-powered table with fast filtering and sorting."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
