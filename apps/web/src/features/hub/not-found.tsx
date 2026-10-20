import { Link } from "@tanstack/react-router";

import { PixelIcon } from "@/components/pixel-icon";
import { FocusItem } from "@/features/input/focus";
import { HeroSprite } from "@/features/sprites/hero-sprite";

/** A page that doesn't exist, in the hub's layout: a big 404, Vivi a little lost, and the way back. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100svh-2.5rem)] flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="ff-brand text-[7rem] leading-none text-white [text-shadow:5px_5px_0_#000] sm:text-[10rem]" style={{ fontWeight: 400 }}>
        4<span className="text-yellow-200">0</span>4
      </div>
      <HeroSprite heroKey="vivi" size={88} />
      <div className="ff-window flex max-w-md flex-col gap-2 px-6 py-4">
        <div className="ff-display text-2xl">Lost in the Mist</div>
        <div className="text-[#c8d0ff]">There's nothing at this address. Even a moogle couldn't find it.</div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <FocusItem>
          <Link to="/" className="ff-panel ff-lift inline-flex items-center gap-2 px-5 py-2 text-lg">
            <PixelIcon name="arrow-left" size={18} /> Title screen
          </Link>
        </FocusItem>
        <FocusItem defaultFocus>
          <Link to="/play" data-on="true" className="ff-panel ff-lift inline-flex items-center gap-2 px-5 py-2 text-lg">
            Back to camp <PixelIcon name="arrow-right" size={18} />
          </Link>
        </FocusItem>
      </div>
    </div>
  );
}
