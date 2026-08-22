import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Menu Builder V3 — Cloud Consulting Mastery",
  description: "Conversion et édition de menus au format CSV V3 Takeaway / Just Eat (36 colonnes).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
