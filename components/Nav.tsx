"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, ClipboardList, Languages } from "lucide-react";
import { saveSettings, useSettings } from "@/lib/use-settings";
import type { Language } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Report", icon: Camera },
  { href: "/complaints", label: "My reports", icon: ClipboardList },
];

const LANGUAGES: { value: Language; short: string; label: string }[] = [
  { value: "en", short: "EN", label: "English" },
  { value: "hi", short: "हिं", label: "हिंदी" },
  { value: "gu", short: "ગુ", label: "ગુજરાતી" },
];

function LanguageMenu() {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.value === settings?.language) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-ghost !rounded-full !px-3.5"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Reply language: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Languages className="size-[18px]" aria-hidden />
        <span className="min-w-6">{current.short}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Reply language"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="absolute right-0 top-full mt-2 w-48 origin-top-right card p-1.5 z-10"
          >
            <li className="px-3 pt-1.5 pb-1 label">Agent replies in</li>
            {LANGUAGES.map((l) => (
              <li key={l.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l.value === current.value}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-surface-2"
                  onClick={() => {
                    saveSettings({ language: l.value });
                    setOpen(false);
                  }}
                >
                  {l.label}
                  {l.value === current.value && <Check className="size-4 text-primary" aria-hidden />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Nav() {
  const path = usePathname();
  const staff = path.startsWith("/officer") || path.startsWith("/agent");
  return (
    <header className="sticky top-0 z-[1000] border-b border-border bg-surface/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link href="/" className="flex items-center gap-2.5 mr-auto rounded-xl" aria-label="Nagrik Saathi home">
          <span
            className="grid place-items-center size-10 rounded-xl bg-primary text-accent text-2xl font-bold leading-none"
            style={{ fontFamily: "var(--font-anek-gu)" }}
            aria-hidden
          >
            ન
          </span>
          <span className="leading-tight">
            <span className="block font-bold text-[17px]">Nagrik Saathi</span>
            <span className="block text-sm text-muted">Civic help for Ahmedabad</span>
          </span>
        </Link>

        <nav aria-label="Main" className="order-last w-full md:order-none md:w-auto flex gap-1 rounded-2xl bg-surface-2 p-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 md:flex-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition-colors ${
                  active ? "text-primary" : "text-muted hover:text-text"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-surface shadow-card"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon className="relative size-[18px]" aria-hidden />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        {staff && <span className="rounded-full bg-accent-soft text-accent-ink px-3 py-1.5 text-xs font-semibold">Staff view</span>}
        <LanguageMenu />
      </div>
    </header>
  );
}
