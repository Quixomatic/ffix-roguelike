import { MAIN_CAST } from "@ffix-roguelike/game-data";
import { Link } from "@tanstack/react-router";

import { MUSIC_SLOTS, useMusic } from "@/features/audio/music";
import { authClient } from "@/lib/auth-client";
import { HeroSprite } from "@/features/sprites/hero-sprite";

/** The title screen: the cast on parade, and the way in. */
export function TitleScreen() {
  const { data: session, isPending } = authClient.useSession();
  useMusic(MUSIC_SLOTS.title);
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-8 overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a3a8a_0%,#0b0f2e_60%,#05060f_100%)] px-4 py-10">
      {/* drifting "memoria" motes */}
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

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
            <Link to="/play" className="ff-window px-10 py-3 text-2xl hover:brightness-125">
              Play ▶
            </Link>
            <Link to="/battle" search={{ world: 0, level: 5, encounter: 0 }} className="text-sm text-[#c8d0ff] hover:text-white">
              Practice battle
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="ff-window px-10 py-3 text-2xl hover:brightness-125">
              Sign in to play ▶
            </Link>
            <Link to="/battle" search={{ world: 0, level: 5, encounter: 0 }} className="text-sm text-[#c8d0ff] hover:text-white">
              Or try a practice battle
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
