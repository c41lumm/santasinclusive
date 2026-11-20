import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
process.env.NEON_AUTH_COOKIE_SECRET = 'test-secret';
process.env.EMAIL_FROM = "Santa's Inclusive Grotto <hey@santasinclusivegrotto.co.uk>";
const p = await import('./phone');

describe('text-code sign-in helpers', () => {
  it('keeps a password secret and gets it back', () => {
    const sealed = p.encryptSecret('a-long-random-password');
    expect(sealed).not.toContain('a-long-random-password');
    expect(p.decryptSecret(sealed)).toBe('a-long-random-password');
  });
  it('refuses a tampered secret', () => {
    const sealed = p.encryptSecret('x');
    expect(() => p.decryptSecret(sealed.slice(0, -2) + 'AA')).toThrow();
  });
  it('reads UK mobiles however they are typed', () => {
    expect(p.phoneNorm('07850 965161')).toBe('447850965161');
    expect(p.phoneNorm('+44 7850 965161')).toBe('447850965161');
    expect(p.phoneNorm('0116 123 4567')).toBeNull();
  });
  it('makes a hidden email on our own domain, and recognises it', () => {
    const e = p.placeholderEmail('447850965161');
    expect(e).toBe('mobile-447850965161@helpers.santasinclusivegrotto.co.uk');
    expect(p.isPlaceholderEmail(e)).toBe(true);
    expect(p.isPlaceholderEmail('callum@example.com')).toBe(false);
  });
  it('makes 6-digit codes and checks them', () => {
    const c = p.newCode();
    expect(c).toMatch(/^\d{6}$/);
    expect(p.sameHash(p.hashCode(c), p.hashCode(c))).toBe(true);
    expect(p.sameHash(p.hashCode(c), p.hashCode('000000' === c ? '111111' : '000000'))).toBe(false);
  });
});
