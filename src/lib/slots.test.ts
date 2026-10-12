import { describe, expect, it } from 'vitest';
import { slotTimes } from './slots';

describe('slotTimes', () => {
  const rules = { visitMinutes: 15, gapMinutes: 5 };
  it('makes 18 times from 10:00 to 16:00, matching the database', () => {
    const s = slotTimes({ opensAt: '10:00', closesAt: '16:00' }, rules, ['12:40', '13:00']);
    expect(s).toHaveLength(18);
    expect(s[0]).toEqual({ startsAt: '10:00', endsAt: '10:15', blocked: false });
    expect(s.at(-1)?.startsAt).toBe('15:40');
    expect(s.filter((x) => x.blocked).map((x) => x.startsAt)).toEqual(['12:40', '13:00']);
  });
  it('adds times when a day is longer', () => {
    expect(slotTimes({ opensAt: '10:00', closesAt: '18:00' }, rules)).toHaveLength(24);
  });
  it('has no times on a closed day', () => {
    expect(slotTimes({ opensAt: '10:00', closesAt: '16:00', closed: true }, rules)).toEqual([]);
  });
});
