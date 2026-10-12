'use client';
import { useState } from 'react';
import { ActionForm, TextField } from '@/components/form';
import { ageBandLabel, ageBands, giftCategories } from '@/lib/options';
import type { FormState } from '@/lib/forms';

function Pick({ legend, name, options, value, onChange }: {
  legend: string; name: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <fieldset className="field" style={{ marginBottom: 16 }}>
      <legend style={{ fontWeight: 700, marginBottom: 6 }}>{legend}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="a-chips">
        {options.map((o) => <button key={o.value} type="button" className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
      </div>
    </fieldset>
  );
}

/** "Add stock" from the AdminToys design */
export function AddStock({ action }: { action: (prev: FormState, fd: FormData) => Promise<FormState> }) {
  const [supplier, setSupplier] = useState('amazon');
  const [band, setBand] = useState('3-5');
  const [cat, setCat] = useState('Sensory');
  const [qty, setQty] = useState(10);
  const [status, setStatus] = useState('ordered');
  const q = (d: number) => () => setQty((v) => Math.max(1, Math.min(5000, v + d)));
  return (
    <ActionForm action={action} submitLabel={status === 'ordered' ? `Add ${qty} as on the way` : `Add ${qty} to stock now`} block
      success={(t) => <p role="status" className="success" style={{ margin: 0, fontWeight: 700 }}>{t} <a href="/admin/toys">Add more</a></p>}>
      <TextField name="name" label="Gift" mark={false} placeholder="For example, Light-up sensory ball" />
      <Pick legend="Bought from" name="supplier" value={supplier} onChange={setSupplier}
        options={[['amazon', 'Amazon'], ['alibaba', 'Alibaba'], ['donated', 'Donated'], ['other', 'Other']].map(([value, label]) => ({ value, label }))} />
      <Pick legend="Age range" name="age_band" value={band} onChange={setBand} options={ageBands.map((b) => ({ value: b, label: ageBandLabel(b) }))} />
      <Pick legend="Type" name="category" value={cat} onChange={setCat} options={giftCategories.map((c) => ({ value: c, label: c }))} />
      <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Quantity</p>
      <input type="hidden" name="qty" value={qty} />
      <div className="stepper" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={q(-10)} aria-label="Ten fewer" style={{ width: 56, borderRadius: 999, fontSize: '0.95rem' }}>−10</button>
        <button type="button" onClick={q(-1)} aria-label="One fewer">−</button>
        <span className="val" aria-live="polite">{qty}</span>
        <button type="button" onClick={q(1)} aria-label="One more">+</button>
        <button type="button" onClick={q(10)} aria-label="Ten more" style={{ width: 56, borderRadius: 999, fontSize: '0.95rem' }}>+10</button>
      </div>
      <Pick legend="Status" name="status" value={status} onChange={setStatus}
        options={[{ value: 'ordered', label: 'Ordered' }, { value: 'here', label: 'Already here' }]} />
      <p className="hint">Use “Already here” for donations dropped off in person. Orders are checked in by the elves when the parcel arrives.</p>
      <TextField name="order_ref" label="Order number" optional placeholder="From your Amazon or Alibaba order" />
    </ActionForm>
  );
}
