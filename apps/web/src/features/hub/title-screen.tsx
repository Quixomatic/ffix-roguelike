import { MAIN_CAST } from "@ffix-roguelike/game-data";
import { Link } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { FocusItem } from "@/features/input/focus";

/** The title screen: the cast on parade, and the way in. */
export function TitleScreen() {
  const { data: session, isPending } = authClient.useSession();
  // The hub shell draws the backdrop and plays the title music (the route's staticData). Centred in the page area
  // (the window's height less the room the shell leaves for its menu button).
  return (
    <div className="flex min-h-[calc(100svh-2.5rem)] flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10">

      <div className="relative text-center font-['Pixelify_Sans'] text-white [text-shadow:3px_3px_0_#000]">
        <div className="ff-title text-base tracking-[0.3em]">A ROGUELITE</div>
        <h1 className="ff-pop text-5xl sm:text-7xl">
          FINAL FANTASY <span className="text-yellow-200">IX</span>
        </h1>
        <div className="mt-2 text-lg opacity-80">Three worlds. One road. Start again — stronger.</div>
      </div>

      <div className="relative flex items-end gap-2 sm:gap-4">
        {MAIN_CAST.map((key, i) => (
          <div key={key} className="ff-hop" style={{ animationDelay: `${i * 120}ms`, animationIterationCount: "infinite", animationDuration: "1.6s" }}>
            <HeroSprite heroKey={key} size={72} />
          </div>
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-3">
        {isPending ? null : session ? (
          <>
            <FocusItem>
              <Link to="/play" className="ff-window px-10 py-3 text-2xl hover:brightness-125">
                Play ▶
              </Link>
            </FocusItem>
            <FocusItem>
              <Link to="/battle" search={{ world: 0, level: 5, encounter: 0 }} className="text-sm text-[#c8d0ff] hover:text-white">
                Practice battle
              </Link>
            </FocusItem>
          </>
        ) : (
          <>
            <FocusItem>
              <Link to="/login" className="ff-window px-10 py-3 text-2xl hover:brightness-125">
                Sign in to play ▶
              </Link>
            </FocusItem>
            <FocusItem>
              <Link to="/battle" search={{ world: 0, level: 5, encounter: 0 }} className="text-sm text-[#c8d0ff] hover:text-white">
                Or try a practice battle
              </Link>
            </FocusItem>
          </>
        )}
      </div>
    </div>
  );
}
