import Link from "next/link";

// Staff tools stay reachable for demos but out of the citizen's way.
export function Footer() {
  return (
    <footer className="w-full max-w-6xl mx-auto px-4 sm:px-8 pb-8 pt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-muted">
      <p>
        For AMC staff:{" "}
        <Link href="/officer" className="font-semibold text-text underline-offset-4 hover:underline">Staff console</Link>
        {" · "}
        <Link href="/agent" className="font-semibold text-text underline-offset-4 hover:underline">Agent activity</Link>
      </p>
      <p>A Garbathon 2026 project. Not an official AMC service.</p>
    </footer>
  );
}
