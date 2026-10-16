import { useState, type ReactNode } from "react";

const storageKey = (id: string) => `ffix-help-dismissed:${id}`;
const read = (id: string) => {
  try {
    return localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
};
const write = (id: string, dismissed: boolean) => {
  try {
    if (dismissed) localStorage.setItem(storageKey(id), "1");
    else localStorage.removeItem(storageKey(id));
  } catch {
    // storage blocked: it just shows again next time
  }
};

/**
 * Help pinned to the top-right corner of the page, dismissible; the choice is remembered in this browser
 * (localStorage, per `id`). Once dismissed, a small "?" button brings it back.
 */
export function HelpCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [dismissed, setDismissed] = useState(() => read(id));
  const set = (d: boolean) => {
    write(id, d);
    setDismissed(d);
  };
  if (dismissed)
    return (
      <button className="ff-window fixed right-4 top-16 z-30 h-9 w-9 text-lg" onClick={() => set(false)} title={`Show “${title}”`} aria-label={`Show ${title}`}>
        ?
      </button>
    );
  return (
    <div className="ff-window fixed right-4 top-16 z-30 w-[22rem] max-w-[calc(100vw-2rem)] p-3 text-sm leading-relaxed">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="ff-title">{title}</span>
        <button className="text-base opacity-70 hover:opacity-100" onClick={() => set(true)} aria-label="Dismiss">
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
