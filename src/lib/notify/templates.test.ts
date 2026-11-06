import { describe, expect, it } from 'vitest';
import { fill, messageDefs, render, templates, wordingProblems, type TemplateName } from './templates';

const v = { name: 'Sam', when: 'Saturday 12 December at 10:20', token: 'tok', reference: 'SIG-1' };

describe('default wording', () => {
  it('fills in the visit details and links', () => {
    expect(templates.confirmation(v).text).toBe(
      "You're booked in! Santa can't wait to meet Sam on Saturday 12 December at 10:20. Your reference is SIG-1. " +
      'Tell Santa about Sam, or change or cancel, here: /booking/tok');
    expect(templates.confirm48h(v).text).toContain('Tap to confirm: /booking/tok/confirm');
    expect(templates.rota('Jess', 'week of 14 December', ['Mon', 'Tue']).text).toContain('week of 14 December:\nMon\nTue\n');
    expect(templates.waitlistOffer('Fri', 'c1', '09:00').text).toContain('until 09:00. Tap to claim it: /claim/c1');
  });
  it('leaves no placeholder unfilled', () => {
    const all = [
      ...(['confirmation', 'pendingReview', 'reminder7d', 'confirm48h', 'missingDetails', 'alreadyBooked', 'moved', 'cancelled', 'duplicateCancelled', 'claimed'] as const)
        .map((n) => templates[n](v)),
      templates.waitlistJoined('Fri', 'l1'), templates.waitlistOffer('Fri', 'c1', '09:00'), templates.rota('Jess', 'wk', ['Mon']),
      templates.bookingOpen('Sam'), templates.runningLate(),
    ];
    for (const m of all) expect(`${m.subject} ${m.text}`).not.toMatch(/\{[a-z_]+\}/);
  });
  it('every default passes its own checks', () => {
    for (const n of Object.keys(messageDefs) as TemplateName[]) {
      expect(wordingProblems(n, messageDefs[n].subject, messageDefs[n].body), n).toEqual([]);
    }
  });
});

describe('saved wording', () => {
  it('replaces the default and keeps the details', () => {
    const m = render('confirmation', templates.confirmation(v).wording!.vars, { subject: 'Hi {name}', body: 'See you {when}: {booking_link}' });
    expect(m).toMatchObject({ subject: 'Hi Sam', text: 'See you Saturday 12 December at 10:20: /booking/tok' });
  });
  it('leaves unknown placeholders alone', () => {
    expect(fill('{name} {nope}', { name: 'Sam' })).toBe('Sam {nope}');
  });
  it('must keep the required link', () => {
    expect(wordingProblems('confirmation', 'Hi', 'No link here')[0].message).toContain('{booking_link}');
  });
  it('cannot use details the message does not have', () => {
    expect(wordingProblems('bookingOpen', 'Hi', '{book_link} {reference}')[0].message).toContain('{reference}');
  });
  it('needs a subject and a message', () => {
    expect(wordingProblems('runningLate', ' ', ' ').map((p) => p.field)).toEqual(['subject', 'body']);
  });
});
