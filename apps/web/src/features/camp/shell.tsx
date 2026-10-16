import { Separator } from "@ffix-roguelike/ui/components/separator";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, Home, Menu, Package, Settings, Shield, Store, Swords, Trophy, Undo2, Users } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

import { MemoriaBackdrop } from "@/components/memoria-backdrop";
import { MUSIC_SLOTS, useMusic } from "@/features/audio/music";
import { FocusItem, FocusSection } from "@/features/input/focus";
import { PAGE_FOCUS, SIDEBAR_FOCUS } from "@/features/input/nav";
import { Avatar } from "@/features/settings/avatar-panel";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import pkg from "../../../package.json";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; exact?: boolean };

/** The game's own destinations (the hub's four cards), then the account-wide pages. */
const GAME_NAV: NavItem[] = [
  { to: "/play", label: "Play", icon: Home, exact: true },
  { to: "/story", label: "Story", icon: BookOpen },
  { to: "/party", label: "Party", icon: Users },
  { to: "/shops/supplies", label: "Supplies", icon: Store },
  { to: "/shops/gear", label: "Gear catalog", icon: Shield },
  { to: "/challenges", label: "Challenges", icon: Swords },
];
const MORE_NAV: NavItem[] = [
  { to: "/items", label: "Items", icon: Package },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/settings", label: "Settings", icon: Settings },
];

/**
 * The hub layout: a sidebar instead of the header bar (logo, name and version, the game's destinations, the account
 * pages, the player at the bottom), and the page beside it, scrolling on its own over the title screen's backdrop.
 * Routes under `_auth/_hub` use it (their layout sets `staticData.shell = "sidebar"`, which hides the header bar).
 */
const SIDEBAR_KEY = "ffix-sidebar-open";

/** Whether the sidebar is out, remembered per browser. */
function useSidebarOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, o ? "0" : "1");
      } catch {
        /* not remembered */
      }
      return !o;
    });
  return [open, toggle];
}

export function HubShell() {
  useMusic(MUSIC_SLOTS.camp);
  const [open, toggle] = useSidebarOpen();
  // Each page is its own focus section, keyed by path so a new page starts the cursor on its first item.
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div
      className={`theme-ff grid h-full bg-background transition-[grid-template-columns] duration-300 ease-out ${open ? "grid-cols-[15rem_minmax(0,1fr)]" : "grid-cols-[0rem_minmax(0,1fr)]"}`}
    >
      {/* The sidebar slides out of its column; while it's away its links are off the cursor's map. */}
      <div className="min-h-0 overflow-hidden" aria-hidden={!open || undefined} inert={!open || undefined}>
        <Sidebar open={open} />
      </div>
      <div className="relative min-h-0">
        {/* Always on screen, inset on the page: slides the sidebar in and out. */}
        <FocusItem>
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Hide the menu" : "Show the menu"}
            aria-expanded={open}
            className="ff-panel ff-lift absolute left-3 top-3 z-20 flex size-10 items-center justify-center rounded-full"
          >
            <Menu className="size-5" />
          </button>
        </FocusItem>
        <FocusSection key={path} focusKey={PAGE_FOCUS} autoFocus>
          <div className="h-full min-h-0 overflow-y-auto" data-scroll-restoration-id="hub-main">
            {/* Room at the top for the menu button. */}
            <MemoriaBackdrop dim={0.55} className="pt-10">
              <Outlet />
            </MemoriaBackdrop>
          </div>
        </FocusSection>
      </div>
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const { data: session } = authClient.useSession();
  const profile = useQuery(trpc.profile.get.queryOptions());
  return (
    <FocusSection focusKey={SIDEBAR_FOCUS} disabled={!open}>
    <aside className={`flex h-full w-60 min-h-0 flex-col gap-3 transition-transform duration-300 ease-out ${open ? "" : "-translate-x-full"} border-r-2 border-[#e8e8f4]/40 bg-gradient-to-b from-[#1b2466] via-[#10164a] to-[#070a1f] p-3 text-sidebar-foreground`}>
      {/* The header bar's wordmark. */}
      <FocusItem>
        <Link to="/play" className="ff-display pt-2 text-center text-2xl tracking-wide text-white [text-shadow:2px_2px_0_#000]">
          FFIX <span className="text-yellow-200">Roguelike</span>
        </Link>
      </FocusItem>
      {/* The name/version line as the separator, like Pokelike's. */}
      <div className="flex items-center gap-2 text-[0.7rem] text-[#c8d0ff]">
        <Separator className="flex-1 bg-white/25" />
        <span>v{pkg.version}</span>
        <Separator className="flex-1 bg-white/25" />
      </div>

      <nav className="flex flex-col gap-0.5">
        {GAME_NAV.map((n) => (
          <NavLink key={n.to} item={n} />
        ))}
      </nav>
      <Separator className="bg-white/15" />
      <nav className="flex flex-col gap-0.5">
        {MORE_NAV.map((n) => (
          <NavLink key={n.to} item={n} />
        ))}
      </nav>

      {/* The original single-page camp, tucked away while the hub grows. */}
      <FocusItem>
        <Link to="/legacy/camp" className="mt-auto flex items-center gap-2 px-3 text-xs text-[#c8d0ff]/70 hover:text-white">
          <Undo2 className="size-3.5" />
          Legacy camp
        </Link>
      </FocusItem>
      <div className="flex items-center gap-2 rounded border border-white/15 bg-black/25 p-2">
        <Avatar image={session?.user.image} name={session?.user.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{session?.user.name ?? "…"}</div>
          <div className="text-xs text-yellow-200">{profile.data ? `${profile.data.gil.toLocaleString()} gil` : ""}</div>
        </div>
      </div>
    </aside>
    </FocusSection>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <FocusItem>
    <Link
      to={item.to}
      activeOptions={{ exact: !!item.exact }}
      className="ff-option flex items-center gap-3 rounded py-1.5 text-base hover:bg-white/10"
      activeProps={{ "data-active": "true", className: "text-yellow-200" }}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
    </FocusItem>
  );
}
