import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DopeChaos — Chaos System Visualizer",
  description:
    "Interactive terminal-style visualizer for chaotic dynamical systems: Logistic Map, Lorenz Attractor, and Julia Set.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
