import { describe, expect, it } from 'vitest';
import { ukMobile } from './booking-schema';

describe('ukMobile', () => {
  it('accepts UK mobiles in any common format and stores them as +447...', () => {
    for (const n of ['07700 900123', '+44 7700 900123', '447700900123', '(07700) 900-123', '0044 7700 900123']) {
      expect(ukMobile.parse(n)).toBe('+447700900123');
    }
  });
  it('refuses landlines and numbers abroad', () => {
    for (const n of ['0116 496 0000', '+1 202 555 0100', '+7 912 345 6789', '7700900123']) {
      expect(ukMobile.safeParse(n).success).toBe(false);
    }
  });
});
