/**
 * Decides when a video should be gated. Pure and DOM-free so it is unit-testable.
 * Re-visiting a video already seen in this tab (e.g. swiping back) never counts again.
 */
export class GateTracker {
  private readonly seen = new Set<string>();
  private sinceLastGate = 0;

  constructor(private interval: number) {}

  setInterval(interval: number): void {
    this.interval = interval;
    this.sinceLastGate = Math.min(this.sinceLastGate, interval - 1);
  }

  get viewedThisSession(): number {
    return this.seen.size;
  }

  /** Records a video as seen without counting it towards the next gate. */
  markSeen(videoId: string): void {
    this.seen.add(videoId);
  }

  /** Returns true if this view is new and should show the gate. */
  onVideoViewed(videoId: string): { isNewView: boolean; shouldGate: boolean } {
    if (this.seen.has(videoId)) return { isNewView: false, shouldGate: false };
    this.seen.add(videoId);
    this.sinceLastGate += 1;
    if (this.sinceLastGate < this.interval) return { isNewView: true, shouldGate: false };
    this.sinceLastGate = 0;
    return { isNewView: true, shouldGate: true };
  }
}
