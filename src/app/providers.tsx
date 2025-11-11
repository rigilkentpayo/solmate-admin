// src/app/providers.tsx
"use client";

import * as React from "react";

// If you use a theme library that toggles "class" on <html>, it can cause mismatches.
// Prefer attribute-based theming or ensure SSR and client default match.
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
