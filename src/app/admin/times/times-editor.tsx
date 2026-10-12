'use client';
import { useState } from 'react';
import { ActionForm } from '@/components/form';
import { slotTimes } from '@/lib/slots';
import { dayName, dayParts } from '@/lib/dates';
import type { FormState } from '@/lib/forms';

type Day = { day: string; opens_at: string; closes_at: string; closed: boolean; own_breaks: boolean };
type Props = {
  year: number; visit_minutes: number; gap_minutes: number; families_per_slot: number; days: Day[];
  everyDayBreaks: string[]; dayBreaks: Record<string, string[]>; booked: Record<string, string[]>;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function Stepper({ label, value, onDec, onInc, unit = '' }: { label: string; value: string | number; onDec: () => void; onInc: () => void; unit?: string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={onDec} aria-label={`Decrease ${label}`}>−</button>
      <span className="val" aria-live="polite">{value}{unit}</span>
      <button type="button" onClick={onInc} aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

/** The AdminSlots design: settings for every day, each day's hours and breaks, then "Save changes" */
export function TimesEditor(props: Props) {
  const [len, setLen] = useState(props.visit_minutes);
  const [gap, setGap] = useState(props.gap_minutes);
  const [cap, setCap] = useState(props.families_per_slot);
  const [days, setDays] = useState(props.days);
  const [everyDay, setEveryDay] = useState(props.everyDayBreaks);
  const [dayBreaks, setDayBreaks] = useState(props.dayBreaks);
  const [sel, setSel] = useState(props.days[0]?.day ?? '');

  const breaksFor = (d: Day) => (d.own_breaks ? dayBreaks[d.day] ?? [] : everyDay);
  const timesFor = (d: Day) => slotTimes({ opensAt: d.opens_at, closesAt: d.closes_at, closed: d.closed }, { visitMinutes: len, gapMinutes: gap }, breaksFor(d));
  const counts: Record<string, number> = Object.fromEntries(days.map((d) => [d.day, timesFor(d).filter((t) => !t.blocked).length]));
  const season = days.reduce((a, d) => a + counts[d.day], 0) * cap;
  const openDays = days.filter((d) => !d.closed).length;
  const cur = days.find((d) => d.day === sel);
  const setDay = (patch: Partial<Day>) => setDays((ds) => ds.map((d) => (d.day === sel ? { ...d, ...patch } : d)));
  const copyTo = (pick: (weekday: number) => boolean) => {
    if (!cur) return;
    setDays((ds) => ds.map((d) => (pick(new Date(`${d.day}T12:00:00Z`).getUTCDay())
      ? { ...d, opens_at: cur.opens_at, closes_at: cur.closes_at, closed: cur.closed } : d)));
  };
  const toggleBreak = (t: string) => {
    if (!cur) return;
    const flip = (list: string[]) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t].sort());
    if (cur.own_breaks) setDayBreaks((b) => ({ ...b, [cur.day]: flip(b[cur.day] ?? []) }));
    else setEveryDay(flip);
  };
  const toggleOwn = () => {
    if (!cur) return;
    if (!cur.own_breaks) setDayBreaks((b) => ({ ...b, [cur.day]: b[cur.day] ?? [...everyDay] }));
    setDay({ own_breaks: !cur.own_breaks });
  };
  const shift = (field: 'opens_at' | 'closes_at', by: number) => {
    if (!cur) return;
    const m = toMin(cur[field]) + by;
    if (field === 'opens_at' && (m < 7 * 60 || m > toMin(cur.closes_at) - 60)) return;
    if (field === 'closes_at' && (m > 21 * 60 || m < toMin(cur.opens_at) + 60)) return;
    setDay({ [field]: toTime(m) });
  };
  const plan = { year: props.year, visit_minutes: len, gap_minutes: gap, families_per_slot: cap, days,
    every_day_breaks: everyDay, day_breaks: Object.fromEntries(days.filter((d) => d.own_breaks).map((d) => [d.day, dayBreaks[d.day] ?? []])) };
  const bookedNow = cur ? props.booked[cur.day] ?? [] : [];
  const lost = cur ? bookedNow.filter((t) => !timesFor(cur).some((x) => x.startsAt === t && !x.blocked)) : [];

  return (
    <ActionForm action={props.action} submitLabel="Save changes"
      success={(t) => <div className="success"><p style={{ fontWeight: 700 }}>{t}</p><p style={{ margin: 0 }}><a href="/admin/times">Back to visit times</a></p></div>}>
      <input type="hidden" name="plan" value={JSON.stringify(plan)} />
      <div className="a-split" style={{ marginBottom: 20 }}>
        <section aria-labelledby="all-h" className="a-panel" style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 id="all-h">Every day</h2>
          <div><p style={{ fontWeight: 700, margin: 0 }}>Visit length</p><p className="muted" style={{ fontSize: '0.9rem' }}>How long each family has with Santa.</p>
            <Stepper label="visit length" value={len} unit=" min" onDec={() => setLen((v) => Math.max(5, v - 5))} onInc={() => setLen((v) => Math.min(60, v + 5))} /></div>
          <div><p style={{ fontWeight: 700, margin: 0 }}>Gap between visits</p><p className="muted" style={{ fontSize: '0.9rem' }}>Time to reset and read the next notes.</p>
            <Stepper label="gap between visits" value={gap} unit=" min" onDec={() => setGap((v) => Math.max(0, v - 5))} onInc={() => setGap((v) => Math.min(30, v + 5))} /></div>
          <div><p style={{ fontWeight: 700, margin: 0 }}>Families per time</p><p className="muted" style={{ fontSize: '0.9rem' }}>Usually one, so every visit stays calm.</p>
            <Stepper label="families per time" value={cap} onDec={() => setCap((v) => Math.max(1, v - 1))} onInc={() => setCap((v) => Math.min(6, v + 1))} /></div>
          <div className="card-pale" style={{ borderRadius: 16, padding: '14px 16px' }}>
            <p className="small" style={{ margin: 0 }}>Whole season</p>
            <p style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: '2.2rem', margin: 0, color: 'var(--green)' }} aria-live="polite">{season}</p>
            <p className="small" style={{ margin: 0 }}>bookable times across {openDays} open days</p>
          </div>
        </section>

        <div className="a-main" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section aria-labelledby="days-h" className="a-panel">
            <h2 id="days-h">Opening hours</h2>
            <p className="muted">Choose a day to change its hours.</p>
            <div className="a-grid-days" role="group" aria-label="Days">
              {days.map((d) => {
                const p = dayParts(d.day);
                return (
                  <button key={d.day} type="button" onClick={() => setSel(d.day)} aria-pressed={d.day === sel}
                    className={`chip${d.day === sel ? ' on' : ''}`} style={{ minHeight: 74, borderRadius: 14, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '8px 10px', borderStyle: d.closed && d.day !== sel ? 'dashed' : undefined }}
                    aria-label={`${dayName(d.day)}, ${d.closed ? 'closed' : `${d.opens_at} to ${d.closes_at}, ${counts[d.day]} bookable times`}`}>
                    <span>{p.weekday} {p.date}</span>
                    <span style={{ fontWeight: 400, fontSize: '0.8rem' }}>{d.closed ? 'Closed' : `${d.opens_at} to ${d.closes_at}`}</span>
                    {!d.closed ? <span style={{ fontWeight: 400, fontSize: '0.8rem' }}>{counts[d.day]} times</span> : null}
                  </button>
                );
              })}
            </div>
          </section>

          {cur ? (
            <section aria-labelledby="ed-h" className="a-panel">
              <div className="admin-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2 id="ed-h" style={{ margin: 0 }}>{dayName(cur.day)}</h2>
                  <p className="muted" aria-live="polite" style={{ margin: 0 }}>{cur.closed ? 'Closed' : `${cur.opens_at} to ${cur.closes_at}, ${counts[cur.day]} bookable times${cap > 1 ? `, up to ${counts[cur.day] * cap} families` : ''}`}</p>
                </div>
                <button type="button" className={`btn ${cur.closed ? 'btn-outline' : 'btn-danger'}`} aria-pressed={cur.closed} onClick={() => setDay({ closed: !cur.closed })}>
                  {cur.closed ? 'Open this day' : 'Close this day'}
                </button>
              </div>
              {cur.closed ? (
                <p className="muted">The grotto is closed on this day, so families cannot book it. Choose “Open this day” to add hours.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 20 }}>
                    <div><p style={{ fontWeight: 700, margin: '0 0 6px' }}>Opens</p>
                      <Stepper label="opening time" value={cur.opens_at} onDec={() => shift('opens_at', -30)} onInc={() => shift('opens_at', 30)} /></div>
                    <div><p style={{ fontWeight: 700, margin: '0 0 6px' }}>Closes</p>
                      <Stepper label="closing time" value={cur.closes_at} onDec={() => shift('closes_at', -30)} onInc={() => shift('closes_at', 30)} /></div>
                    <div><p style={{ fontWeight: 700, margin: '0 0 6px' }}>Copy these hours to</p>
                      <div className="a-chips">
                        <button type="button" className="chip" onClick={() => copyTo(() => true)}>Every day</button>
                        <button type="button" className="chip" onClick={() => copyTo((w) => w >= 1 && w <= 5)}>Weekdays</button>
                        <button type="button" className="chip" onClick={() => copyTo((w) => w === 0 || w === 6)}>Weekends</button>
                      </div></div>
                  </div>
                  <div className="admin-head" style={{ marginBottom: 10 }}>
                    <div><p style={{ fontWeight: 700, margin: 0 }}>Times on this day</p>
                      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>Tap a time to block it for a break, tap again to open it.</p></div>
                    <button type="button" className={`chip${cur.own_breaks ? '' : ' on'}`} aria-pressed={!cur.own_breaks} onClick={toggleOwn}>
                      {cur.own_breaks ? 'Breaks for this day only' : 'Same breaks every day'}
                    </button>
                  </div>
                  <div className="a-times" role="group" aria-label="Times">
                    {timesFor(cur).map((t) => {
                      const isBooked = bookedNow.includes(t.startsAt);
                      return (
                        <button key={t.startsAt} type="button" aria-pressed={t.blocked} disabled={isBooked && !t.blocked} onClick={() => toggleBreak(t.startsAt)}
                          aria-label={`${t.startsAt}, ${isBooked ? 'booked' : t.blocked ? 'blocked, choose to open' : 'open, choose to block'}`}>
                          <span>{t.startsAt}</span><small>{isBooked ? 'Booked' : t.blocked ? 'Blocked' : `to ${t.endsAt}`}</small>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {lost.length ? (
                <p className="notice" style={{ marginTop: 16 }} role="status">
                  Families are booked at {lost.join(', ')} on this day, which these hours would remove or block. Move them first, or saving will be refused.
                </p>
              ) : null}
              <div className="a-note" style={{ marginTop: 16 }}>
                <p><strong>Families already booked?</strong> Making a day longer simply adds new times. If you shorten or close a day that has bookings
                  outside the new hours, saving is refused until you move those families on the Bookings page.</p>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </ActionForm>
  );
}
