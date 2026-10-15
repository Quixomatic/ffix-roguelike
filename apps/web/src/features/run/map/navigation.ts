/**
 * SMW-style overworld walking as a pure, time-stepped state machine (no Phaser) over the branch tree from
 * `layout.branchesFrom(stage)`:
 *  - at a stage or a fork the walker rests; pressing the direction of a branch walks it;
 *  - corners inside a branch are auto-walked; the walker stops at the next fork (unless the held direction
 *    names one of its branches, so holding feels continuous) or at the next stage, where it *stands*;
 *  - standing on a stage doesn't commit: `confirm()` (Enter/Space/click) enters it; until then it may reverse
 *    (press the opposite of its heading) back toward the stage it left, and stops there; there's no road back
 *    past that stage, and no road on from a stage it hasn't entered;
 *  - `goTo(stage)` auto-walks there, taking the right branch at every fork (walking back first if needed), and
 *    enters it on arrival (a click is already a choice).
 */
import { OPPOSITE, stepDir, type Branch, type Dir, type TilePoint } from "./layout";

export class Walker {
  /** Branches entered since leaving the stage; the last one is where the walker is. Empty = at the stage. */
  trail: Branch[] = [];
  /** Distance (tiles) along the current branch. */
  s = 0;
  /** 1 forward, -1 back toward the stage, 0 resting. */
  moving: 0 | 1 | -1 = 0;
  /** Standing on a stage it walked to, not entered yet. */
  standing: string | null = null;
  /** Set once a stage is entered (confirmed): the walker is done. */
  arrived: string | null = null;
  /** Auto-walk destination (click). */
  target: string | null = null;

  constructor(
    readonly start: TilePoint,
    readonly roots: Branch[],
  ) {}

  private get top(): Branch | undefined {
    return this.trail[this.trail.length - 1];
  }

  private len(b: Branch) {
    return b.tiles.length - 1;
  }

  /** Branches you can take from where the walker rests (none while moving). */
  options(): Branch[] {
    if (this.moving || this.arrived || this.standing) return [];
    const top = this.top;
    return top ? top.children : this.roots;
  }

  /** The way back toward the stage from a resting fork, if any. */
  backDir(): Dir | null {
    const top = this.top;
    if (this.moving || this.arrived || !top) return null;
    return OPPOSITE[stepDir(top.tiles[top.tiles.length - 2]!, top.tiles[top.tiles.length - 1]!)];
  }

  /** The direction the walker is currently heading (or last headed). */
  heading(): Dir | null {
    const top = this.top;
    if (!top) return null;
    const i = Math.min(Math.floor(this.s), this.len(top) - 1);
    const d = stepDir(top.tiles[i]!, top.tiles[i + 1]!);
    return this.moving === -1 ? OPPOSITE[d] : d;
  }

  /** Where the walker is, in (fractional) tile coordinates. */
  position(): TilePoint {
    const top = this.top;
    if (!top) return this.start;
    const i = Math.min(Math.floor(this.s), this.len(top) - 1);
    const f = this.s - i;
    const a = top.tiles[i]!;
    const b = top.tiles[i + 1]!;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  /** A direction press. Returns true if it did something. */
  press(dir: Dir): boolean {
    if (this.arrived || this.target) return false;
    if (this.moving) {
      if (this.heading() === OPPOSITE[dir]) {
        this.moving = this.moving === 1 ? -1 : 1;
        return true;
      }
      return false;
    }
    const next = this.options().find((b) => b.dir === dir);
    if (next) {
      this.trail.push(next);
      this.s = 0;
      this.moving = 1;
      return true;
    }
    if (this.backDir() === dir) {
      this.standing = null;
      this.moving = -1;
      return true;
    }
    return false;
  }

  /** Enter the stage the walker is standing on. Returns it (the move to commit), or null. */
  confirm(): string | null {
    if (this.arrived || this.moving || !this.standing) return null;
    this.arrived = this.standing;
    this.standing = null;
    return this.arrived;
  }

  /** Auto-walk to a destination stage reachable from the starting stage. */
  goTo(stage: string): boolean {
    if (this.arrived || this.moving) return false;
    if (!this.roots.some((b) => b.stages.includes(stage))) return false;
    this.target = stage;
    this.standing = null;
    this.steer();
    return true;
  }

  /** At a decision point with a target: pick the branch toward it, or head back. */
  private steer() {
    const t = this.target!;
    const next = this.options().find((b) => b.stages.includes(t));
    if (next) {
      this.trail.push(next);
      this.s = 0;
      this.moving = 1;
    } else if (this.top) this.moving = -1;
    else this.target = null;
  }

  /**
   * Advance by `dist` tiles. `held` is the direction currently held (lets the walker roll straight through a
   * fork or back through one). Returns the stage arrived at, if this step arrived.
   */
  update(dist: number, held: Dir | null): string | null {
    while (dist > 1e-9 && this.moving) {
      const top = this.top!;
      const len = this.len(top);
      if (this.moving === 1) {
        const step = Math.min(len - this.s, dist);
        this.s += step;
        dist -= step;
        if (this.s < len - 1e-9) continue;
        this.s = len;
        if (top.to) {
          this.moving = 0;
          // A click (target) enters straight away; walking by keys stops on the stage to be confirmed.
          if (this.target) {
            this.arrived = top.to;
            this.target = null;
            return top.to;
          }
          this.standing = top.to;
          return null;
        }
        if (this.target) {
          this.moving = 0;
          this.steer();
          continue;
        }
        const next = held ? top.children.find((b) => b.dir === held) : undefined;
        this.moving = 0;
        if (next) {
          this.trail.push(next);
          this.s = 0;
          this.moving = 1;
        }
      } else {
        const step = Math.min(this.s, dist);
        this.s -= step;
        dist -= step;
        if (this.s > 1e-9) continue;
        this.trail.pop();
        const prev = this.top;
        this.moving = 0;
        if (!prev) {
          this.s = 0;
          if (this.target) this.steer();
          continue;
        }
        this.s = this.len(prev);
        if (this.target) this.steer();
        else if (held && held === this.backDir()) this.moving = -1;
      }
    }
    return null;
  }
}
