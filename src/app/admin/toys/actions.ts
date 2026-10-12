'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { text, zodErrors, type FormState } from '@/lib/forms';
import { ageBands as bands } from '@/lib/options';


const stock = z.object({
  name: z.string().trim().min(1, 'Please give the gift a name').max(120),
  supplier: z.enum(['amazon', 'alibaba', 'donated', 'other']),
  age_band: z.enum(bands),
  category: z.string().trim().min(1).max(40),
  qty: z.coerce.number().int().min(1, 'Please give a quantity').max(5000),
  status: z.enum(['ordered', 'here']),
  order_ref: z.string().trim().max(80).optional(),
});

/** "Add stock": an order on the way, or gifts already here (for example donations dropped off) */
export async function addStock(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  const parsed = stock.safeParse({
    name: text(fd, 'name'), supplier: text(fd, 'supplier'), age_band: text(fd, 'age_band'), category: text(fd, 'category'),
    qty: text(fd, 'qty'), status: text(fd, 'status'), order_ref: text(fd, 'order_ref') || undefined,
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const s = parsed.data;
  const here = s.status === 'here';
  await asStaff((sql) => [sql`
    with existing as (select id from gifts where lower(name) = lower(${s.name}) and age_band = ${s.age_band} limit 1),
    created as (insert into gifts (name, age_band, category) select ${s.name}, ${s.age_band}, ${s.category}
                where not exists (select 1 from existing) returning id),
    gift as (select id from existing union all select id from created)
    insert into stock_orders (gift_id, supplier, order_ref, qty_ordered, qty_received, status, received_at, received_by, created_by)
    select id, ${s.supplier}, ${s.order_ref ?? null}, ${s.qty}, ${here ? s.qty : 0}, ${here ? 'received' : 'on_the_way'},
           ${here ? new Date().toISOString() : null}::timestamptz, case when ${here} then app.uid() end, app.uid()
    from gift`]);
  revalidatePath('/admin/toys');
  return { done: `${s.qty} x ${s.name} ${here ? 'added to stock.' : 'added as on the way. The elves will check it in when it arrives.'}` };
}

export async function setSiblingsGetGift(year: number, on: boolean) {
  await requireStaff(['admin']);
  await asStaff((sql) => [sql`update seasons set siblings_get_gift = ${on} where year = ${year}`]);
  revalidatePath('/admin/toys');
}
