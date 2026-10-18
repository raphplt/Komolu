/** Token bucket: `capacity` messages in a burst, then one every `refillMs`. */
export class TokenBucket {
  readonly capacity: number
  readonly refillMs: number
  private tokens: number
  private updatedAt: number

  constructor(capacity: number, refillMs: number, now: number) {
    this.capacity = capacity
    this.refillMs = refillMs
    this.tokens = capacity
    this.updatedAt = now
  }

  take(now: number): boolean {
    const elapsed = Math.max(0, now - this.updatedAt)
    this.tokens = Math.min(this.capacity, this.tokens + elapsed / this.refillMs)
    this.updatedAt = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}

/** Sliding-window counters keyed by client address, for coarse abuse limits. */
export class WindowCounter {
  private readonly hits = new Map<string, number[]>()
  readonly limit: number
  readonly windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  hit(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    return true
  }

  sweep(now: number): void {
    for (const [key, hits] of this.hits) {
      const recent = hits.filter((at) => now - at < this.windowMs)
      if (recent.length) this.hits.set(key, recent)
      else this.hits.delete(key)
    }
  }
}
