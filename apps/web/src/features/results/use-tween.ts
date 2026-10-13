import { useEffect, useState } from "react";

/** Animate a number from `from` to `to` (ease-out), starting after `delay` ms. */
export function useTween(from: number, to: number, duration = 1400, delay = 0): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    setValue(from);
    if (from === to) return;
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const tick = (t: number) => {
        if (!start) start = t;
        const k = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - k, 3);
        setValue(from + (to - from) * eased);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [from, to, duration, delay]);
  return value;
}
