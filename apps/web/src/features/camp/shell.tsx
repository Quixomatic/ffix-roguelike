import { Separator } from "@ffix-roguelike/ui/components/separator";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ffix-roguelike/ui/components/tooltip";
import { BarChart3, FlaskConical, Gamepad2, Home, Menu, Package, Settings, Sparkles, Sword, Trophy, Undo2, Wrench } from "lucide-react";
import { setFocus, type NextFocusResolver } from "@noriginmedia/norigin-spatial-navigation";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import { MemoriaBackdrop } from "@/components/memoria-backdrop";
import { PixelIcon } from "@/components/pixel-icon";
import { MUSIC_SLOTS, useMusic } from "@/features/audio/music";
import { DEFAULT_FOCUS, FocusItem, FocusSection } from "@/features/input/focus";
import { CONTENT_FOCUS, MENU_BUTTON_FOCUS, MENU_EVENT, PAGE_FOCUS, quickFocus, SIDEBAR_FOCUS } from "@/features/input/nav";
import { claimInput, inputOwner } from "@/features/input/owner";
import { Avatar } from "@/features/settings/avatar-panel";
import { authClient, isAdminUser } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import pkg from "../../../package.json";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Also highlighted on these paths (and below them). */
  alsoOn?: string[];
};

/** Home (the title screen) and Play (everything in the game is reached from there), then the account-wide pages. */
const GAME_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  // Story, Party, the shops and Challenges are reached from Play, like a game's own menus.
  { to: "/play", label: "Play", icon: Gamepad2, alsoOn: ["/story", "/party", "/shops", "/challenges", "/run"] },
];
const MORE_NAV: NavItem[] = [
  { to: "/items", label: "Items", icon: Package },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];
/** Admins only (better-auth's admin role). The effects gallery needs a development server (its FFRK library). */
const ADMIN_NAV: NavItem[] = [
  { to: "/admin/rewards", label: "Rewards & gear", icon: Wrench },
  { to: "/admin/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/admin/practice", label: "Practice", icon: Sword },
  { to: "/admin/dev", label: "Dev tools", icon: FlaskConical },
  ...(import.meta.env.DEV ? [{ to: "/admin/effects", label: "Effects", icon: Sparkles }] : []),
];

/**
 * The hub layout: a sidebar instead of the header bar (logo, name and version, the game's destinations, the account
 * pages, the player at the bottom), and the page beside it, scrolling on its own over the title screen's backdrop.
 * Routes under `_auth/_hub` use it (their layout sets `staticData.shell = "sidebar"`, which hides the header bar).
 */
const SIDEBAR_KEY = "ffix-sidebar-open";

/**
 * How the cursor moves between the page's three parts — the content, the menu button (top left) and the shortcuts
 * (top right) — which float over each other, so geometry alone can't. Within the content it moves as usual; this is
 * for leaving it. ← from the content goes to the menu button first; ← again leaves the page for the sidebar (only when
 * it's out — a slid-away sidebar's links are off the cursor's map). null: leave the page.
 */
const pageResolver: NextFocusResolver = (direction, from, siblings) => {
  const byKey = (k: string) => siblings.find((s) => s.focusKey === k) ?? null;
  const quick = siblings.filter((s) => s.focusKey.startsWith("quick-")).sort((a, b) => a.focusKey.localeCompare(b.focusKey));
  const content = byKey(CONTENT_FOCUS);
  if (from === CONTENT_FOCUS) {
    if (direction === "up" || direction === "left") return byKey(MENU_BUTTON_FOCUS);
    if (direction === "right") return quick[0] ?? null;
    return null;
  }
  if (from === MENU_BUTTON_FOCUS) {
    // → goes into the page (the shortcuts are across the whole page: → from the content's right edge reaches them).
    if (direction === "down" || direction === "right") return content;
    return null;
  }
  const i = quick.findIndex((q) => q.focusKey === from);
  if (i >= 0) {
    if (direction === "up") return quick[i - 1] ?? null;
    if (direction === "down") return quick[i + 1] ?? content;
    if (direction === "left") return content;
    return null;
  }
  return null;
};

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
  // The page's music, backdrop and shortcuts come from its route (staticData): the title screen has its own music, the
  // run plays its own (null) and hides the shortcuts; the rest are camp.
  const music = useRouterState({
    select: (s) => {
      const m = s.matches.findLast((x) => x.staticData && "music" in x.staticData);
      return m ? m.staticData.music : "camp";
    },
  });
  const dim = useRouterState({ select: (s) => s.matches.findLast((m) => m.staticData?.backdropDim != null)?.staticData.backdropDim ?? 0.55 });
  const quickLinks = useRouterState({ select: (s) => s.matches.findLast((m) => m.staticData?.quickLinks != null)?.staticData.quickLinks ?? true });
  const menuInset = useRouterState({ select: (s) => s.matches.findLast((m) => m.staticData?.menuButton)?.staticData.menuButton === "inset" });
  const topInset = useRouterState({ select: (s) => s.matches.findLast((m) => m.staticData?.topInset != null)?.staticData.topInset ?? true });
  useMusic(music ? MUSIC_SLOTS[music] : undefined);
  const [open, toggle] = useSidebarOpen();
  // Each page is its own focus section, keyed by path so a new page starts the cursor on its first item.
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Where the cursor lands on arriving: the control the address names (`?focus=`, carried over from the last page — e.g.
  // the character sheet's chevrons), else the page's `defaultFocus` item, else its first item.
  const urlFocus = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>).focus });
  const landOn = typeof urlFocus === "string" && urlFocus ? urlFocus : DEFAULT_FOCUS;
  // M / the controller's Start: open or close the menu, and take the cursor (and the controls — over a game too) with
  // it. Cancel (Escape / B) closes it again; a menu that was already out stays out and just gives the controls back.
  const menuClaim = useRef<{ release(): void; opened: boolean } | null>(null);
  useEffect(() => {
    const close = () => {
      const claim = menuClaim.current;
      menuClaim.current = null;
      claim?.release();
      if (!claim || claim.opened) toggle();
      requestAnimationFrame(() => void setFocus(PAGE_FOCUS));
    };
    const onMenu = () => {
      // Over a game (the overworld, a battle) an open sidebar doesn't have the cursor yet: Start takes it there.
      if (open && !menuClaim.current && inputOwner() !== "game") return close();
      if (menuClaim.current) return close();
      if (!open) toggle();
      menuClaim.current = { release: claimInput("menu", close), opened: !open };
      requestAnimationFrame(() => void setFocus(SIDEBAR_FOCUS));
    };
    window.addEventListener(MENU_EVENT, onMenu);
    return () => window.removeEventListener(MENU_EVENT, onMenu);
  }, [open, toggle]);
  // Going to another page (a sidebar link) ends the menu's claim on the controls.
  useEffect(() => {
    menuClaim.current?.release();
    menuClaim.current = null;
  }, [path]);
  return (
    <div
      className={`theme-ff grid h-full bg-background transition-[grid-template-columns] duration-300 ease-out ${open ? "grid-cols-[15rem_minmax(0,1fr)]" : "grid-cols-[0rem_minmax(0,1fr)]"}`}
    >
      {/* The sidebar slides out of its column; while it's away its links are off the cursor's map. */}
      <div className="min-h-0 overflow-hidden" aria-hidden={!open || undefined} inert={!open || undefined}>
        <Sidebar open={open} />
      </div>
      {/* The page's cursor section holds the menu button and the shortcuts too, so ↑ from the top of a page reaches them. */}
      <FocusSection key={path} focusKey={PAGE_FOCUS} preferredChild={CONTENT_FOCUS} resolver={pageResolver} autoFocus>
      <div className="relative min-h-0">
        {/* Always on screen, inset on the page: slides the sidebar in and out (or M / Start). */}
        <FocusItem focusKey={MENU_BUTTON_FOCUS}>
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Hide the menu (M)" : "Show the menu (M)"}
            title={open ? "Hide the menu (M)" : "Show the menu (M)"}
            aria-expanded={open}
            className={`ff-panel ff-lift absolute z-30 flex size-10 items-center justify-center rounded-full ${menuInset ? "left-7 top-7" : "left-3 top-3"}`}
          >
            <Menu className="size-5" />
          </button>
        </FocusItem>
        {quickLinks && <QuickLinks />}
        {/* The content is its own section: arriving on a page lands on its first item, not the menu button. */}
        <FocusSection focusKey={CONTENT_FOCUS} preferredChild={landOn}>
          <div className="h-full min-h-0 overflow-y-auto" data-scroll-restoration-id="hub-main">
            {/* Room at the top for the menu button (unless the page clears it sideways, like the run). */}
            <MemoriaBackdrop dim={dim} className={topInset ? "pt-10" : ""}>
              <Outlet />
            </MemoriaBackdrop>
          </div>
        </FocusSection>
      </div>
      </FocusSection>
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const { data: session } = authClient.useSession();
  const profile = useQuery({ ...trpc.profile.get.queryOptions(), enabled: !!session });
  return (
    <FocusSection focusKey={SIDEBAR_FOCUS} disabled={!open}>
    <aside className={`flex h-full w-60 min-h-0 flex-col gap-3 transition-transform duration-300 ease-out ${open ? "" : "-translate-x-full"} border-r-2 border-[#e8e8f4]/40 bg-gradient-to-b from-[#1b2466] via-[#10164a] to-[#070a1f] p-3 text-sidebar-foreground`}>
      {/* The header bar's wordmark: home (the title screen). */}
      <FocusItem>
        <Link to="/" className="ff-display pt-2 text-center text-2xl tracking-wide text-white [text-shadow:2px_2px_0_#000]">
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
        {[...GAME_NAV, ...MORE_NAV].map((n) => (
          <NavLink key={n.to} item={n} />
        ))}
      </nav>
      {isAdminUser(session?.user) && (
        <>
          <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-wider text-orange-300/80">
            <Separator className="flex-1 bg-orange-300/30" />
            Admin
            <Separator className="flex-1 bg-orange-300/30" />
          </div>
          <nav className="flex flex-col gap-0.5">
            {ADMIN_NAV.map((n) => (
              <NavLink key={n.to} item={n} />
            ))}
          </nav>
        </>
      )}

      {/* The original single-page camp, tucked away while the hub grows. */}
      <FocusItem>
        <Link to="/legacy/camp" className="mt-auto flex items-center gap-2 px-3 text-xs text-[#c8d0ff]/70 hover:text-white">
          <Undo2 className="size-3.5" />
          Legacy camp
        </Link>
      </FocusItem>
      {session ? (
        <div className="flex items-center gap-2 rounded border border-white/15 bg-black/25 p-2">
          <Avatar image={session.user.image} name={session.user.name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{session.user.name}</div>
            <div className="text-xs text-yellow-200">{profile.data ? `${profile.data.gil.toLocaleString()} gil` : ""}</div>
          </div>
        </div>
      ) : (
        <FocusItem>
          <Link to="/login" className="ff-panel ff-lift flex items-center justify-center gap-2 px-3 py-2 text-base">
            Sign in <PixelIcon name="arrow-right" />
          </Link>
        </FocusItem>
      )}
    </aside>
    </FocusSection>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  // Play stays lit everywhere you go from it (Story, Party, the shops, Challenges, a run).
  const also = useRouterState({ select: (st) => !!item.alsoOn?.some((p) => st.location.pathname === p || st.location.pathname.startsWith(`${p}/`)) });
  return (
    <FocusItem>
    <Link
      to={item.to}
      activeOptions={{ exact: !!item.exact }}
      className={`ff-option flex items-center gap-3 rounded py-1.5 text-base hover:bg-white/10 ${also ? "text-yellow-200" : ""}`}
      data-active={also || undefined}
      activeProps={{ "data-active": "true", className: "text-yellow-200" }}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
    </FocusItem>
  );
}

/**
 * Banked gil and CP in the page's top-right corner, and a floating stack of round shortcuts below them — on every hub
 * page, staying put while it scrolls. Signed in only.
 */
function QuickLinks() {
  const { data: session } = authClient.useSession();
  const profile = useQuery({ ...trpc.profile.get.queryOptions(), enabled: !!session });
  if (!session || !profile.data) return null;
  const p = profile.data;
  const cp = p.unlocked.reduce((n, k) => n + (p.builds[k]!.points ?? 0), 0);
  return (
    <div className="absolute right-5 top-3 z-20 flex flex-col items-end gap-3">
      <div className="flex gap-2">
        <span className="ff-chip">{p.gil.toLocaleString()} gil</span>
        <span className="ff-chip">{cp} CP</span>
      </div>
      <div className="flex flex-col gap-2">
        <RoundLink index={0} to="/items" label="Items" icon={Package} />
        <RoundLink index={1} to="/achievements" label="Achievements" icon={Trophy} />
        <RoundLink index={2} to="/settings" label="Settings" icon={Settings} />
      </div>
    </div>
  );
}

function RoundLink({ index, to, label, icon: Icon }: { index: number; to: string; label: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <Tooltip>
      <FocusItem focusKey={quickFocus(index)}>
        <TooltipTrigger render={<Link to={to} aria-label={label} />} className="ff-panel ff-lift flex size-11 items-center justify-center rounded-full">
          <Icon className="size-5" />
        </TooltipTrigger>
      </FocusItem>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
