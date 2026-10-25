"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Every animation follows the visitor's reduced-motion setting. */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
