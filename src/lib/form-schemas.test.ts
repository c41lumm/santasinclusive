import { describe, expect, it } from 'vitest';
import { alertSchema } from './form-schemas';
import { bookingSchema } from './booking-schema';

describe('alertSchema', () => {
  const base = { name: 'Sam', is_group: false };
  it('takes an email address, stored in lower case', () => {
    expect(alertSchema.parse({ ...base, contact: 'Sam@Example.com' })).toMatchObject({ contact: 'sam@example.com' });
  });
  it('refuses a mobile number, pointing at the email box', () => {
    const r = alertSchema.safeParse({ ...base, contact: '07700 900123' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['contact']);
  });
});

describe('bookingSchema', () => {
  const base = {
    slot_id: '5c9e58bc-1dc9-453c-9771-2c35974ba03d', contact_name: 'Pat', channels: ['sms'],
    eligibility_confirmed: true, data_consent: true, visitors: [{ kind: 'visitor', first_name: 'Ada', age: '' }],
  };
  it('needs a mobile number for texts', () => {
    const r = bookingSchema.safeParse({ ...base, email: 'pat@example.com' });
    expect(r.error?.issues.map((i) => i.path.join('.'))).toContain('phone');
  });
  it('treats blank answers as not given', () => {
    const r = bookingSchema.parse({ ...base, phone: '07700900123', email: '  ', postcode: '' });
    expect(r.email).toBeUndefined();
    expect(r.postcode).toBeUndefined();
    expect(r.visitors[0].age).toBeUndefined();
  });
  it('explains an unticked agreement in words', () => {
    const r = bookingSchema.safeParse({ ...base, phone: '07700900123', eligibility_confirmed: false });
    expect(r.error?.issues[0].message).toMatch(/disability/);
  });
});
