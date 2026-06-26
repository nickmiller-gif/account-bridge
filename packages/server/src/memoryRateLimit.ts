import type { Request, Response, NextFunction } from 'express';

export interface MemoryRateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}

export function createMemoryRateLimit(options: MemoryRateLimitOptions) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const message = options.message ?? 'Too many requests. Try again later.';

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.keyFn?.(req) ?? req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
