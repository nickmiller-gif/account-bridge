import { describe, expect, it } from 'vitest';

import { friendlyCopilotError } from './uxCopy.js';

describe('friendlyCopilotError', () => {
  it('maps 401-style errors to reconnect guidance', () => {
    expect(friendlyCopilotError('401 invalid api key')).toContain('invalid');
  });

  it('preserves reconnect messages', () => {
    const msg = 'OAuth refresh failed — reconnect in settings';
    expect(friendlyCopilotError(msg)).toBe(msg);
  });
});
