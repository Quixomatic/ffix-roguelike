import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import { PixelIcon } from "@/components/pixel-icon";
import { FocusItem } from "@/features/input/focus";

/** One step of the trail: a page to go back to (`to`, with its route `params` / `search`), or the current page (no `to`). */
export interface Crumb {
  label: string;
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
}

/** The trail's first step, "Home": the Play hub, where every camp page is reached from. */
export const CAMP: Crumb = { label: "Home", to: "/play" };

/**
 * Where a camp page sits ("Home › Story › 1 · The Evil Forest"): every step but the last goes back there, so each page
 * has an easy way back besides the browser's Back and Escape. Cursor stops, with the cancel sound like other back links.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumbs" className="ff-display flex flex-wrap items-center gap-x-2 gap-y-1 text-lg [text-shadow:2px_2px_0_#000]">
      {crumbs.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 && <PixelIcon name="arrow-right" className="opacity-70" />}
          {c.to && i < crumbs.length - 1 ? (
            // Arriving on a page lands on its content, never here; ↑ from the content's top reaches the trail.
            <FocusItem skipOnLanding>
              {/* Routes are typed per path; the trail is data, so the link takes them loosely. */}
              <Link to={c.to as never} params={c.params as never} search={c.search as never} data-sound="cancel" className="text-[#c8d0ff] transition-colors hover:text-white">
                {c.label}
              </Link>
            </FocusItem>
          ) : (
            <span aria-current="page" className="text-yellow-200">
              {c.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
