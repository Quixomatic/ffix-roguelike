/**
 * Deterministic, serializable RNG (mulberry32). Every random roll in the game goes through one of these so
 * the server can replay a battle or a run from its seed and get exactly the same result as the client.
 */
export class Rng {
  constructor(public state: number) {
    this.state = state >>> 0;
  }

  static fromSeed(seed: string | number): Rng {
    if (typeof seed === "number") return new Rng(seed);
    // FNV-1a hash of the string seed.
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return new Rng(h >>> 0);
  }

  /** Float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `percent`/100. */
  chance(percent: number): boolean {
    return this.next() * 100 < percent;
  }

  pick<T>(list: readonly T[]): T {
    if (!list.length) throw new Error("Rng.pick on empty list");
    return list[Math.floor(this.next() * list.length)]!;
  }

  weighted<T>(list: readonly { weight: number; value: T }[]): T {
    const total = list.reduce((s, x) => s + Math.max(0, x.weight), 0);
    if (total <= 0) return this.pick(list).value;
    let roll = this.next() * total;
    for (const x of list) {
      roll -= Math.max(0, x.weight);
      if (roll < 0) return x.value;
    }
    return list[list.length - 1]!.value;
  }

  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  }

  /** Derive an independent child stream (e.g. one per map node) without disturbing this one. */
  fork(label: string | number): Rng {
    return Rng.fromSeed(`${this.state}:${label}`);
  }
}
