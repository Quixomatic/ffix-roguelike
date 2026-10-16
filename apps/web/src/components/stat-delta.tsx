import { Badge } from "./badge";

/**
 * A stat change on a subtle badge: the caret and number coloured (green ▲ up, red ▼ down), the stat name in plain
 * text — e.g. "▲2 Def".
 */
export function StatDelta({ value, label }: { value: number; label: string }) {
  const up = value > 0;
  return (
    <Badge className="tabular-nums">
      <span className={up ? "text-green-300" : "text-red-300"}>
        <span aria-label={up ? "up" : "down"}>{up ? "▲" : "▼"}</span>
        {Math.abs(value)}
      </span>
      {label}
    </Badge>
  );
}
