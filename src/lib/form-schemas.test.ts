import { describe, expect, it } from 'vitest';
import { alertSchema } from './form-schemas';
import { bookingSchema, checkBooking } from './booking-schema';

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
  it('reports a missing mobile or email together with every other problem', () => {
    const r = checkBooking({ ...base, channels: ['email', 'sms'], contact_name: '', data_consent: false, visitors: [{ kind: 'visitor', first_name: '' }] });
    const fields = r.error?.issues.map((i) => i.path.join('.'));
    expect(fields).toEqual(expect.arrayContaining(['contact_name', 'data_consent', 'visitors.0.first_name', 'email', 'phone']));
  });
  it('does not repeat a problem', () => {
    const r = checkBooking({ ...base, contact_name: '' });
    expect(r.error?.issues.filter((i) => i.path.join('.') === 'phone')).toHaveLength(1);
  });
  it('still accepts a good booking', () => {
    expect(checkBooking({ ...base, phone: '07700900123' }).success).toBe(true);
  });
});
