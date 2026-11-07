'use client';
import { useState } from 'react';
import { ActionForm, Choices, TextArea, TextField } from '@/components/form';
import { volunteerDayTypes, volunteerWeeks } from '@/lib/options';
import type { FormState } from '@/lib/forms';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** "Edit details" on a helper's page. When they can help only shows for helpers on the rota. */
export function EditHelper({ action, name, phone, onRota, weeks, dayTypes, note }: {
  action: Action; name: string; phone: string; onRota: boolean; weeks: string[]; dayTypes: string[]; note: string;
}) {
  const [open, setOpen] = useState(false);
  // "Any day" is saved as the whole season, which is not one of the week boxes, so it shows as none ticked
  const ticked = weeks.filter((w) => volunteerWeeks.includes(w));
  if (!open) return <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>Edit details</button>;
  return (
    <section className="a-panel" aria-labelledby="edit-h">
      <h2 id="edit-h">Edit details</h2>
      <ActionForm action={action} submitLabel="Save"
        secondary={<button type="button" className="btn btn-plain" onClick={() => setOpen(false)}>Cancel</button>}
        success={(d) => <div className="success"><p style={{ margin: 0, fontWeight: 700 }}>{d}</p><p style={{ margin: '8px 0 0' }}><button type="button" className="link-button" onClick={() => setOpen(false)}>Done</button></p></div>}>
        <TextField name="name" label="Name" defaultValue={name} autoComplete="off" autoCapitalize="words" />
        <TextField name="phone" type="tel" label="Mobile number" optional defaultValue={phone} inputMode="tel" autoComplete="off" width="medium" />
        {onRota ? (
          <>
            <Choices type="checkbox" name="weeks" legend="When could they help?" layout="grid" optional defaultValue={ticked}
              hint="Leave these blank if they can help any day." choices={volunteerWeeks.map((w) => ({ value: w, label: w }))} />
            <Choices type="checkbox" name="day_types" legend="Which days suit them?" layout="grid" optional defaultValue={dayTypes}
              choices={volunteerDayTypes.map((d) => ({ value: d, label: d }))} />
            <TextArea name="note" label="Note" optional rows={3} maxLength={1000} defaultValue={note}
              hint="Anything to remember when planning the rota, for example “Saturdays only” or “not 12 December”." />
          </>
        ) : null}
      </ActionForm>
    </section>
  );
}
