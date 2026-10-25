"use client";

import { useEffect, useState } from "react";
import type { Settings } from "./types";

const EVENT = "nagrik:settings";

/** Saves a settings change and tells every mounted useSettings() (header, report page) right away. */
export async function saveSettings(patch: Partial<Settings>) {
  window.dispatchEvent(new CustomEvent<Partial<Settings>>(EVENT, { detail: patch }));
  await fetch("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => alive && setSettings(d.settings))
      .catch(() => {});
    const onChange = (e: Event) => {
      const patch = (e as CustomEvent<Partial<Settings>>).detail;
      setSettings((s) => (s ? { ...s, ...patch } : s));
    };
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);

  return settings;
}
