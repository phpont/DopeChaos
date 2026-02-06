"use client";

import { ASCII_LOGO } from "@/lib/constants";

export function AsciiLogo() {
  return (
    <pre className="ascii-logo" aria-label="DopeChaos">
      {ASCII_LOGO}
    </pre>
  );
}
