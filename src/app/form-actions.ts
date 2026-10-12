'use server';
import { asPublic, db } from '@/lib/db';
import { alertSchema, groupSchema, sponsorSchema, volunteerSchema, waitlistSchema } from '@/lib/form-schemas';
import { checkPublicForm } from '@/lib/public-form';
import { getDays, getSeason } from '@/lib/public-data';
import { dayName } from '@/lib/dates';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { all, problem, text, ticked, zodErrors, type FormState } from '@/lib/forms';

// The public forms other than booking. Each runs the bot check and rate limit, then saves.
// Rows go in as the public (anon) role, so the database's own insert rules apply, except the waitlist,
// which also sends a message and so needs the new row's id.

export async function joinWaitlist(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = waitlistSchema.safeParse({
    day: text(fd, 'day'), time_pref: text(fd, 'time_pref'), contact_name: text(fd, 'contact_name'),
    email: text(fd, 'email'), phone: text(fd, 'phone'), channels: all(fd, 'channels'),
    eligibility_confirmed: ticked(fd, 'eligibility_confirmed'), data_consent: ticked(fd, 'data_consent'),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const w = parsed.data;
  const season = await getSeason();
  if (!season?.booking_open || !(await getDays(season.year)).some((d) => d.day === w.day)) {
    return problem('Please choose a day from the list', 'day');
  }
  const blocked = await checkPublicForm(fd, 'waitlist');
  if (blocked) return blocked;

  const [row] = await db()`
    insert into waitlist_entries (day, time_pref, contact_name, email, phone, channels, eligibility_confirmed, data_consent)
    values (${w.day}, ${w.time_pref}, ${w.contact_name}, ${w.email ?? null}, ${w.phone ?? null}, ${w.channels}::channel[], true, true)
    returning id`;
  await send({ email: w.email, phone: w.phone, channels: w.channels }, templates.waitlistJoined(dayName(w.day)),
    { waitlist_id: row.id as string, template: 'waitlistJoined' });
  return { done: dayName(w.day) };
}

export async function signUpForAlert(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = alertSchema.safeParse({
    name: text(fd, 'name'), contact: text(fd, 'contact'), is_group: ticked(fd, 'is_group'), data_consent: ticked(fd, 'data_consent'),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const blocked = await checkPublicForm(fd, 'alert');
  if (blocked) return blocked;
  const a = parsed.data;
  await asPublic((sql) => [sql`
    insert into early_alerts (name, contact, channels, is_group) values (${a.name}, ${a.contact}, ${[...a.channels]}::channel[], ${a.is_group})`]);
  return { done: a.channels[0] === 'email' ? 'email' : 'text' };
}

export async function sendGroupEnquiry(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = groupSchema.safeParse({
    organisation: text(fd, 'organisation'), contact_name: text(fd, 'contact_name'), role: text(fd, 'role'),
    email: text(fd, 'email'), phone: text(fd, 'phone'), people: text(fd, 'people'), staff: text(fd, 'staff'),
    age_range: text(fd, 'age_range'), weeks: all(fd, 'weeks'), time_pref: all(fd, 'time_pref'), needs: text(fd, 'needs'),
    data_consent: ticked(fd, 'data_consent'),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const blocked = await checkPublicForm(fd, 'group');
  if (blocked) return blocked;
  const g = parsed.data;
  await asPublic((sql) => [sql`
    insert into group_enquiries (organisation, contact_name, role, email, phone, people, staff, age_range, weeks, time_pref, needs)
    values (${g.organisation}, ${g.contact_name}, ${g.role ?? null}, ${g.email}, ${g.phone}, ${g.people}, ${g.staff},
            ${g.age_range}, ${g.weeks}, ${g.time_pref}, ${g.needs ?? null})`]);
  return { done: 'yes' };
}

export async function applyToVolunteer(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = volunteerSchema.safeParse({
    role: text(fd, 'role'), name: text(fd, 'name'), email: text(fd, 'email'), phone: text(fd, 'phone'),
    available_days: all(fd, 'available_days'), over_18: ticked(fd, 'over_18'), experience: text(fd, 'experience'),
    why: text(fd, 'why'), own_suit: text(fd, 'own_suit') === 'yes' ? true : text(fd, 'own_suit') === 'no' ? false : undefined,
    data_consent: ticked(fd, 'data_consent'),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const blocked = await checkPublicForm(fd, 'volunteer');
  if (blocked) return blocked;
  const v = parsed.data;
  await asPublic((sql) => [sql`
    insert into volunteers (name, email, phone, role, available_days, over_18, experience, why, own_suit)
    values (${v.name}, ${v.email}, ${v.phone}, ${v.role}, ${v.available_days}::date[], true, ${v.experience ?? null},
            ${v.why ?? null}, ${v.role === 'santa' ? (v.own_suit ?? null) : null})`]);
  return { done: 'yes' };
}

export async function offerSponsorship(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = sponsorSchema.safeParse({
    company: text(fd, 'company'), contact_name: text(fd, 'contact_name'), email: text(fd, 'email'), gifts: text(fd, 'gifts'),
    amount_pounds: text(fd, 'amount_pounds'), pay_method: text(fd, 'pay_method'), show_on_wall: ticked(fd, 'show_on_wall'),
    logo_requested: ticked(fd, 'logo_requested'), data_consent: ticked(fd, 'data_consent'),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const blocked = await checkPublicForm(fd, 'sponsor');
  if (blocked) return blocked;
  const s = parsed.data;
  await asPublic((sql) => [sql`
    insert into sponsorships (company, contact_name, email, gifts, amount_pence, pay_method, show_on_wall, logo_requested)
    values (${s.company}, ${s.contact_name}, ${s.email}, ${s.gifts}, ${Math.round(s.amount_pounds * 100)}, ${s.pay_method},
            ${s.show_on_wall}, ${s.logo_requested})`]);
  return { done: 'yes' };
}
