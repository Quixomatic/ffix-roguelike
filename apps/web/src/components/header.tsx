import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { FocusItem } from "@/features/input/focus";

export default function Header() {
  const links = [
    { to: "/play", label: "Camp" },
    { to: "/run", label: "Run" },
    { to: "/achievements", label: "Achievements" },
    { to: "/battle", label: "Practice" },
    { to: "/items", label: "Items" },
  ] as const;

  return (
    <header className="border-b-2 border-[#e8e8f4]/70 bg-gradient-to-b from-[#24317a] to-[#141b52] shadow-[0_2px_0_rgba(0,0,0,0.6)]">
      <div className="flex flex-row items-center justify-between px-3 py-1.5">
        <nav className="flex items-center gap-5 ff-display text-lg text-white [text-shadow:2px_2px_0_#000]">
          <FocusItem>
            <Link to="/" className="mr-2 text-xl tracking-wide">
              FFIX <span className="text-yellow-200">Roguelike</span>
            </Link>
          </FocusItem>
          {links.map(({ to, label }) => (
            <FocusItem key={to}>
              <Link to={to} className="opacity-80 hover:opacity-100 [&.active]:text-yellow-200 [&.active]:opacity-100">
                {label}
              </Link>
            </FocusItem>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <>
              <FocusItem>
                <Link to="/effects" className="text-sm text-orange-300 opacity-80 hover:opacity-100 [&.active]:opacity-100" title="FFRK effects gallery (development only)">
                  Effects
                </Link>
              </FocusItem>
              <FocusItem>
                <Link to="/dev" className="text-sm text-orange-300 opacity-80 hover:opacity-100 [&.active]:opacity-100" title="Dev tools (development only)">
                  Dev
                </Link>
              </FocusItem>
            </>
          )}
          <FocusItem>
            <Link to="/settings" className="text-lg text-white opacity-80 hover:opacity-100 [&.active]:text-yellow-200" title="Settings" aria-label="Settings">
              ⚙
            </Link>
          </FocusItem>
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
