import { all, text, ticked } from '@/lib/forms';

/** Reads the booking form (public, or the admin "Add booking" form) into the shape bookingSchema checks */
export function bookingInputFromForm(fd: FormData) {
  let visitors: unknown = [];
  try { visitors = JSON.parse(text(fd, 'visitors') ?? '[]'); } catch { /* the schema reports it */ }
  return {
    slot_id: text(fd, 'slot_id'),
    contact_name: text(fd, 'contact_name'),
    email: text(fd, 'email'),
    phone: text(fd, 'phone'),
    postcode: text(fd, 'postcode'),
    address_line: text(fd, 'address_line'),
    channels: all(fd, 'channels'),
    photo_consent: text(fd, 'photo_consent'),
    eligibility_confirmed: ticked(fd, 'eligibility_confirmed'),
    data_consent: ticked(fd, 'data_consent'),
    visitors,
  };
}
