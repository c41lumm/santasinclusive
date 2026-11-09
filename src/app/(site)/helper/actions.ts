'use server';
import { revalidatePath } from 'next/cache';
import { getStaff } from '@/lib/auth/staff';
import { isUuid } from '@/lib/admin/data';
import { asStaff } from '@/lib/db';

/** A helper accepts, or says they cannot do, one of their own shifts */
export async function respondToShift(shiftId: string, accept: boolean) {
  if (!(await getStaff()) || !isUuid(shiftId)) return;
  await asStaff((sql) => [sql`select respond_to_shift(${shiftId}::uuid, ${accept})`]);
  revalidatePath('/helper');
  revalidatePath('/admin/rota');
}
