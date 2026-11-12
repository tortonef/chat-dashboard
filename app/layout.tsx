import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat Dashboard",
  description: "A dashboard you customize by chatting: requests become SQL queries and charts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
