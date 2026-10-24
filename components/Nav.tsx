"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Camera, ClipboardList, Landmark } from "lucide-react";

const LINKS = [
  { href: "/", label: "Report", icon: Camera },
  { href: "/complaints", label: "My complaints", icon: ClipboardList },
  { href: "/officer", label: "AMC Officer", icon: Landmark },
  { href: "/agent", label: "Agent control", icon: Bot },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1000] border-b border-border bg-surface/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="grid place-items-center size-8 rounded-lg bg-accent text-white font-bold">ન</span>
          <span className="leading-tight">
            <span className="block font-bold text-sm">Nagrik Saathi</span>
            <span className="block text-[11px] text-muted">AMC complaint agent</span>
          </span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto ml-auto -mr-2 pr-2 [scrollbar-width:none]">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  active ? "bg-primary-soft text-primary" : "text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
