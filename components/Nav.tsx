"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Camera, ClipboardList, Landmark, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/", label: "Report", icon: Camera },
  { href: "/complaints", label: "My complaints", icon: ClipboardList },
  { href: "/officer", label: "AMC Officer", icon: Landmark },
  { href: "/agent", label: "Agent control", icon: Bot },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1000] border-b border-border bg-surface/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-[72px] flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="grid place-items-center size-10 rounded-xl bg-accent text-white text-lg font-bold">ન</span>
          <span className="leading-tight hidden sm:block">
            <span className="block font-bold">Nagrik Saathi</span>
            <span className="block text-xs text-muted">AMC complaint agent · Ahmedabad</span>
          </span>
        </Link>
        <nav className="ml-auto flex gap-1 rounded-xl bg-surface-2 p-1 overflow-x-auto [scrollbar-width:none]">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-sm whitespace-nowrap transition ${
                  active ? "bg-surface text-primary font-semibold shadow-sm" : "text-muted font-medium hover:text-text"
                }`}
              >
                <Icon className="size-4 md:hidden" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-ok-soft text-ok px-3 py-1.5 text-xs font-semibold">
          <Sparkles className="size-3" /> Agent online
        </span>
      </div>
    </header>
  );
}
