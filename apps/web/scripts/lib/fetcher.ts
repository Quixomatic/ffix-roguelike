/// <reference types="node" />
/**
 * A reusable downloader for asset scrapers (FFRK sheets, effects, sounds, wiki images):
 *
 * - **Disk cache**: files land under `root` mirroring their path; anything already there is read, not refetched.
 * - **Missing cache**: 404/403 paths are appended to `<root>/.missing` and skipped on later runs.
 * - **Parallel pool** (`run`), **timeouts** (AbortSignal) and **retries** with backoff, so one stalled connection
 *   can't hang a run.
 * - **Progress bars** per stage — count, rate, ETA — redrawn in place on a terminal, periodic lines otherwise.
 *
 * It never keeps file contents around: `get` returns the bytes for the caller to use and forget.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface FetcherOptions {
  /** Local folder files are cached under (`<root>/<path>`). */
  root: string;
  /** URL prefix a path is appended to. */
  baseUrl: string;
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
  /** Optional mapping from a path to its local file name (default: the path itself under root). */
  localPath?: (path: string) => string;
  /** Request headers (e.g. a User-Agent for sites that want one). */
  headers?: Record<string, string>;
}

export class Fetcher {
  readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly missingFile: string;
  private readonly missing: Set<string>;
  /** Network requests made / files downloaded this run (for summaries). */
  requests = 0;
  downloaded = 0;

  constructor(private readonly opts: FetcherOptions) {
    this.concurrency = opts.concurrency ?? 16;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.retries = opts.retries ?? 3;
    mkdirSync(opts.root, { recursive: true });
    this.missingFile = join(opts.root, ".missing");
    this.missing = new Set(existsSync(this.missingFile) ? readFileSync(this.missingFile, "utf8").split("\n").filter(Boolean) : []);
  }

  file(path: string): string {
    return this.opts.localPath ? this.opts.localPath(path) : join(this.opts.root, ...path.split("/"));
  }

  has(path: string): boolean {
    return existsSync(this.file(path));
  }

  isMissing(path: string): boolean {
    return this.missing.has(path);
  }

  /** The file's bytes — from disk if cached, else downloaded (and cached). Null if the server doesn't have it. */
  async get(path: string, url = `${this.opts.baseUrl}${path}`): Promise<Uint8Array | null> {
    const file = this.file(path);
    if (existsSync(file)) return new Uint8Array(readFileSync(file));
    if (this.missing.has(path)) return null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        this.requests++;
        const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs), headers: this.opts.headers });
        if (res.status === 404 || res.status === 403 || res.status === 410) {
          this.missing.add(path);
          appendFileSync(this.missingFile, `${path}\n`);
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, data);
        this.downloaded++;
        return data;
      } catch {
        if (attempt < this.retries) await sleep(500 * 2 ** attempt);
      }
    }
    return null; // gave up (network trouble): not remembered as missing, so a re-run retries it
  }

  /** Text of a cached-or-downloaded file. */
  async text(path: string): Promise<string | null> {
    const data = await this.get(path);
    return data ? new TextDecoder().decode(data) : null;
  }

  /** Run `fn` over `items` with the pool's concurrency, showing a progress bar labelled `label`. */
  async run<T>(label: string, items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> {
    const bar = new Progress(label, items.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, items.length) }, async () => {
        while (next < items.length) {
          const item = items[next++]!;
          try {
            await fn(item);
          } finally {
            bar.tick();
          }
        }
      }),
    );
    bar.done();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A one-line progress bar: `label [██████░░░░] 1,234/5,678  42/s  eta 1m45s`. */
export class Progress {
  private count = 0;
  private readonly start = Date.now();
  private lastDraw = 0;
  private readonly tty = !!process.stdout.isTTY;

  constructor(
    private readonly label: string,
    private readonly total: number,
  ) {
    this.draw(true);
  }

  tick(n = 1) {
    this.count += n;
    this.draw(false);
  }

  done() {
    this.count = this.total;
    this.draw(true);
    if (this.tty) process.stdout.write("\n");
  }

  private draw(force: boolean) {
    const now = Date.now();
    // Terminals redraw ~10×/s; logs get a line every 5 s.
    if (!force && now - this.lastDraw < (this.tty ? 100 : 5000)) return;
    this.lastDraw = now;
    const secs = (now - this.start) / 1000;
    const rate = secs > 0 ? this.count / secs : 0;
    const left = rate > 0 ? (this.total - this.count) / rate : 0;
    const width = 24;
    const filled = this.total ? Math.round((this.count / this.total) * width) : width;
    const line = `${this.label.padEnd(18)} [${"█".repeat(filled)}${"░".repeat(width - filled)}] ${this.count.toLocaleString()}/${this.total.toLocaleString()}  ${rate.toFixed(0)}/s  ${this.count < this.total ? `eta ${fmt(left)}` : `${fmt(secs)}`}`;
    if (this.tty) process.stdout.write(`\r${line}\x1b[K`);
    else console.log(line);
  }
}

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s` : `${s.toFixed(0)}s`);
