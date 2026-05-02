import { describe, expect, it } from 'vitest';
import { truncateHexString } from './helpers';

describe('truncateHexString', () => {
  it('keeps the start and end of long hexadecimal values', () => {
    expect(truncateHexString('0x1234567890abcdef')).toBe('0x12345...bcdef');
  });
});
