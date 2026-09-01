import { Injectable, Logger } from '@nestjs/common';

type Entry = { value: unknown; expiresAt: number };

/**
 * A deliberately small in-process TTL cache for the dashboard aggregates.
 *
 * Why not Redis: the API runs as a single instance on one EC2 box, so a shared
 * cache would add a network hop and a moving part for zero benefit. The tradeoff
 * is that this cache does not survive a restart and would not be coherent across
 * replicas — at which point the honest upgrade is Redis, not a bigger Map.
 *
 * The aggregates are invalidated on write rather than merely expiring, so the
 * dashboard never shows a number that contradicts a live event the user just saw.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, Entry>();

  async wrap<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
    const value = await factory();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  /** Drops every key beginning with `prefix`. Called whenever bookings change. */
  invalidate(prefix: string): void {
    let dropped = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        dropped++;
      }
    }
    if (dropped > 0) {
      this.logger.debug(`Invalidated ${dropped} cache entrie(s) for "${prefix}"`);
    }
  }

  clear(): void {
    this.store.clear();
  }
}
