'use client';
import { useState } from 'react';
import { ActionForm } from '@/components/form';
import type { FormState } from '@/lib/forms';

const templateNames = [
  { key: 'reminder', label: 'Reminder' }, { key: 'confirm', label: 'Please confirm' },
  { key: 'details', label: 'Missing details' }, { key: 'late', label: 'Running late' },
];

/** "Send a message" from the AdminBookings design: channels, template, preview, send */
export function Composer({ to, previews, action, defaultTemplate = 'reminder' }: {
  to: string; previews: Record<string, string>; defaultTemplate?: string;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [channels, setChannels] = useState<string[]>(['email', 'sms']);
  const [template, setTemplate] = useState(defaultTemplate);
  const toggle = (c: string) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const via = channels.map((c) => (c === 'sms' ? 'text' : 'email')).join(' and ') || 'no channel chosen';
  return (
    <section aria-label="Send a message" className="a-panel" style={{ border: '2px solid var(--green)' }}>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>Message</h2>
      <p className="muted" style={{ fontSize: '0.95rem' }}>To: {to}</p>
      <ActionForm action={action} submitLabel={`Send by ${via}`} block
        success={(text) => <p role="status" className="success" style={{ margin: 0, fontWeight: 700 }}>{text}</p>}>
        {channels.map((c) => <input key={c} type="hidden" name="channels" value={c} />)}
        <input type="hidden" name="template" value={template} />
        <p style={{ fontWeight: 700, margin: '0 0 6px', fontSize: '0.95rem' }}>Send by</p>
        <div className="a-chips" style={{ marginBottom: 14 }}>
          {[['email', 'Email'], ['sms', 'Text']].map(([c, l]) => (
            <button key={c} type="button" className="chip" aria-pressed={channels.includes(c)} onClick={() => toggle(c)}>{l}</button>
          ))}
        </div>
        <p style={{ fontWeight: 700, margin: '0 0 6px', fontSize: '0.95rem' }}>Message</p>
        <div className="a-chips" style={{ marginBottom: 14 }}>
          {templateNames.map((t) => (
            <button key={t.key} type="button" className="chip" aria-pressed={template === t.key} onClick={() => setTemplate(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="preview" aria-live="polite">{previews[template]}</div>
      </ActionForm>
    </section>
  );
}
