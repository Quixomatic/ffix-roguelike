import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

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
    <nav aria-label="Breadcrumbs" className="ff-title flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm tracking-[0.2em]">
      {crumbs.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 && <span className="opacity-50">›</span>}
          {c.to && i < crumbs.length - 1 ? (
            <FocusItem>
              {/* Routes are typed per path; the trail is data, so the link takes them loosely. */}
              <Link to={c.to as never} params={c.params as never} search={c.search as never} data-sound="cancel" className="uppercase text-[#c8d0ff] hover:text-white hover:underline">
                {c.label}
              </Link>
            </FocusItem>
          ) : (
            <span aria-current="page" className="uppercase">
              {c.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
