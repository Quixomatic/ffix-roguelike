import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { cloneElement, useEffect, type ReactElement, type Ref, type RefObject } from "react";

import { uiSound } from "@/features/audio/ui-sounds";

/**
 * Building blocks for keyboard / controller navigation (see `nav.ts`). Wrap what the cursor can land on in
 * `FocusItem`, and groups of them in `FocusSection`:
 *
 *   <FocusSection focusKey={PAGE_FOCUS} autoFocus>
 *     <FocusItem><Link to="/story">Story</Link></FocusItem>
 *     <FocusItem><button onClick={…}>Begin</button></FocusItem>
 *   </FocusSection>
 *
 * Both wrap their single child element (no extra DOM), so layouts — grids, subgrids, flex rows — stay as they are.
 * The child should be a real control (button / link) so Enter, Space and the controller's A press it.
 */

type ChildProps = { ref?: Ref<HTMLElement>; onMouseEnter?: (e: React.MouseEvent) => void };

function useMergedRef<T>(inner: RefObject<T | null>, outer: Ref<T> | undefined) {
  return (node: T | null) => {
    (inner as { current: T | null }).current = node;
    if (typeof outer === "function") outer(node);
    else if (outer) (outer as { current: T | null }).current = node;
  };
}

const keysMode = () => document.documentElement.dataset.input === "keys";

/** Something the cursor can land on. Hovering it with the mouse moves the cursor there too, so keys carry on from it. */
export function FocusItem({ children, focusKey, onFocus }: { children: ReactElement<ChildProps>; focusKey?: string; onFocus?(): void }) {
  const { ref, focusSelf, focused } = useFocusable<object, HTMLElement>({
    focusKey,
    onFocus: (layout) => {
      // Keyboard / controller: bring it into view and tick (the mouse already shows where it is).
      if (keysMode()) {
        (layout.node as HTMLElement | undefined)?.scrollIntoView({ block: "nearest", inline: "nearest" });
        uiSound("cursor");
      }
      onFocus?.();
    },
  });
  const child = children;
  return cloneElement(child, {
    ref: useMergedRef(ref, child.props.ref),
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e);
      // Not while typing: hovering shouldn't pull the focus out of a text field.
      const typing = document.activeElement?.matches("input, textarea, select, [contenteditable='true']");
      if (!focused && !typing) focusSelf();
    },
  });
}

/**
 * A group of `FocusItem`s (a nav list, a card grid, a page). It remembers its last focused item: moving back into it
 * (or `autoFocus` on mount) lands there, else on its first item. Wraps its single child element.
 */
export function FocusSection({
  children,
  focusKey,
  autoFocus,
  boundary,
}: {
  children: ReactElement<ChildProps>;
  focusKey?: string;
  /** Focus this section when it mounts (a page's main content). */
  autoFocus?: boolean;
  /** Keep the cursor inside (dialogs). */
  boundary?: boolean;
}) {
  const { ref, focusKey: key, focusSelf } = useFocusable<object, HTMLElement>({
    focusKey,
    trackChildren: true,
    saveLastFocusedChild: true,
    isFocusBoundary: boundary,
  });
  useEffect(() => {
    if (autoFocus) focusSelf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const child = children;
  return <FocusContext.Provider value={key}>{cloneElement(child, { ref: useMergedRef(ref, child.props.ref) })}</FocusContext.Provider>;
}
