'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { isUuid } from '@/lib/admin/data';
import { rotaData } from '@/lib/admin/rota';
import { dayName } from '@/lib/dates';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import type { FormState } from '@/lib/forms';

export async function makeShifts(year: number) {
  await requireStaff(['admin', 'lead_elf']);
  await asStaff((sql) => [sql`select ensure_shifts(${year})`]);
  revalidatePath('/admin/rota');
}

export async function assign(shiftId: string, volunteerId: string, role: 'santa' | 'elf') {
  await requireStaff(['admin', 'lead_elf']);
  if (!isUuid(shiftId) || !isUuid(volunteerId)) return;
  await asStaff((sql) => [sql`insert into shift_assignments (shift_id, volunteer_id, role) values (${shiftId}::uuid, ${volunteerId}::uuid, ${role}::staff_role) on conflict do nothing`]);
  revalidatePath('/admin/rota');
}

export async function unassign(shiftId: string, volunteerId: string) {
  await requireStaff(['admin', 'lead_elf']);
  if (!isUuid(shiftId) || !isUuid(volunteerId)) return;
  await asStaff((sql) => [sql`delete from shift_assignments where shift_id = ${shiftId}::uuid and volunteer_id = ${volunteerId}::uuid`]);
  revalidatePath('/admin/rota');
}

export async function setNeeded(shiftId: string, role: 'santa' | 'elf', by: number) {
  await requireStaff(['admin', 'lead_elf']);
  if (!isUuid(shiftId)) return;
  await asStaff((sql) => [role === 'santa'
    ? sql`update shifts set santas_needed = greatest(0, least(6, santas_needed + ${by})) where id = ${shiftId}::uuid`
    : sql`update shifts set elves_needed = greatest(0, least(12, elves_needed + ${by})) where id = ${shiftId}::uuid`]);
  revalidatePath('/admin/rota');
}

/** "Send this week's rota": each volunteer gets their own shifts by email and text */
export async function sendRota(year: number, first: string, last: string, label: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  await requireStaff(['admin', 'lead_elf']);
  const { vols, shifts } = await rotaData(year);
  const week = shifts.filter((s) => s.day >= first && s.day <= last);
  let sentTo = 0;
  for (const v of vols) {
    const mine = week.filter((s) => s.people.some((p) => p.volunteer_id === v.id));
    if (!mine.length) continue;
    const lines = mine.map((s) => `${dayName(s.day)}, ${s.name.toLowerCase()} ${s.starts} to ${s.ends}`);
    const results = await send({ email: v.email, phone: v.phone, channels: ['email', 'sms'] },
      templates.rota(v.name.split(' ')[0], label, lines), { volunteer_id: v.id, template: 'rota' });
    if (results.some((r) => r.ok)) sentTo++;
  }
  revalidatePath('/admin/messages');
  return { done: `Sent to ${sentTo} ${sentTo === 1 ? 'volunteer' : 'volunteers'}.` };
}
