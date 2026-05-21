import Link from "next/link";
import { LayoutDashboard, Images, Copy, Sparkles, History, Search, Plus } from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: Images },
  { href: "/duplicates", label: "Duplicates", icon: Copy },
  { href: "/cleanup", label: "Cleanup", icon: Sparkles },
  { href: "/search", label: "Search", icon: Search },
  { href: "/operations", label: "History", icon: History },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-card/40 md:flex">
      <div className="flex h-14 items-center gap-2 px-5">
        <div className="size-5 rounded bg-gradient-to-br from-amber-400 to-rose-500" />
        <span className="font-semibold tracking-tight">Gallery Sort</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-2 text-sm">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-2">
        <Link
          href="/scan"
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" /> Add library
        </Link>
      </div>
    </aside>
  );
}
