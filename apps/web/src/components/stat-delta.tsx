import { Badge } from "./badge";

/**
 * A stat change on a subtle badge: the signed number coloured (green +, red −), the stat name in plain text —
 * e.g. "+2 Def".
 */
export function StatDelta({ value, label }: { value: number; label: string }) {
  const up = value > 0;
  return (
    <Badge className="tabular-nums">
      <span className={up ? "text-green-300" : "text-red-300"}>
        {up ? "+" : "−"}
        {Math.abs(value)}
      </span>
      {label}
    </Badge>
  );
}
