'use client';
import { useRef, useState } from 'react';
import { ActionForm, TextArea, TextField, Tick } from '@/components/form';
import { fill, sampleVars, type TemplateName } from '@/lib/notify/templates';
import type { FormState } from '@/lib/forms';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Var = { key: string; label: string; required: boolean };

// Texts: plain characters fit 160 per text (153 each when split); emoji and some symbols drop that to 70 (67)
const GSM = /^[A-Za-z0-9 \n\r@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;
function texts(t: string) {
  const plain = GSM.test(t);
  const len = [...t].length;
  const [one, many] = plain ? [160, 153] : [70, 67];
  return { len, count: len <= one ? 1 : Math.ceil(len / many), plain };
}
const countLine = (t: ReturnType<typeof texts>) =>
  `${t.len} characters. As a text this is ${t.count === 1 ? '1 text' : `${t.count} texts`}${!t.plain ? ' (emoji and some symbols make texts shorter)' : ''}.`;

/** Puts {detail} where the cursor is in a message box, then puts the cursor after it */
function insertAt(id: string, value: string, set: (v: string) => void, key: string) {
  const el = document.getElementById(id) as HTMLTextAreaElement | null;
  const token = `{${key}}`;
  const at = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length;
  set(value.slice(0, at) + token + value.slice(end));
  requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
}

function DetailButtons({ vars, onAdd, label }: { vars: Var[]; onAdd: (key: string) => void; label: string }) {
  if (!vars.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Add a detail</p>
      <p className="hint" style={{ margin: '0 0 8px' }}>Each one is filled in for the person it goes to. Starred ones must stay in the message.</p>
      <div className="a-chips" role="group" aria-label={label}>
        {vars.map((v) => (
          <button key={v.key} type="button" className="chip" onClick={() => onAdd(v.key)} aria-label={`Add ${v.label}${v.required ? ', must stay in the message' : ''}`}>
            {v.label}{v.required ? ' *' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WordingEditor({ name, subject: s0, body: b0, sms: t0, original, vars, save, test }: {
  name: TemplateName; subject: string; body: string; sms: string | null; original: { subject: string; body: string };
  vars: Var[]; save: Action; test: Action;
}) {
  const [subject, setSubject] = useState(s0);
  const [body, setBody] = useState(b0);
  const [smsOn, setSmsOn] = useState(t0 !== null);
  const [sms, setSms] = useState(t0 ?? '');
  const smsTouched = useRef(t0 !== null);
  const samples = sampleVars(name);
  const textNow = smsOn ? sms : body;
  const changed = subject !== s0 || body !== b0 || smsOn !== (t0 !== null) || (smsOn && sms !== (t0 ?? ''));

  const turnSmsOn = (on: boolean) => {
    // Start the text from the email wording, to shorten, the first time it is turned on
    if (on && !smsTouched.current) { setSms(body); smsTouched.current = true; }
    setSmsOn(on);
  };
  const undo = () => { setSubject(s0); setBody(b0); setSmsOn(t0 !== null); setSms(t0 ?? ''); };

  return (
    <div className="a-split" style={{ alignItems: 'flex-start' }}>
      <section className="a-panel a-main" aria-labelledby="edit-h">
        <ActionForm action={save} submitLabel="Save wording"
          success={(d) => <div className="success"><p style={{ fontWeight: 700 }}>{d}</p><p style={{ margin: 0 }}><a href={`/admin/wording/${name}`}>Back to this message</a> · <a href="/admin/wording">All messages</a></p></div>}
          secondary={changed ? <button type="button" className="btn btn-plain" onClick={undo}>Undo changes</button> : null}>
          <h2 id="edit-h">Email</h2>
          <TextField name="subject" label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          <DetailButtons vars={vars} label="Details you can add to the email" onAdd={(k) => insertAt('body', body, setBody, k)} />
          <TextArea name="body" label="Email message" rows={10} value={body} onChange={setBody} maxLength={2000}
            hint={<>The details show as {'{name}'} and so on here. Press Enter for a new line.</>} />
          {body !== original.body || subject !== original.subject ? (
            <details style={{ marginBottom: 16 }}>
              <summary>See the original wording</summary>
              <p style={{ fontWeight: 700, margin: '8px 0 4px' }}>{original.subject}</p>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{original.body}</p>
            </details>
          ) : null}

          <h2 style={{ marginTop: 28 }}>Text message</h2>
          <Tick name="sms_on" label="Send a different, shorter text message" optional checked={smsOn} onChange={turnSmsOn}
            hint="Families who chose texts get this instead of the email wording. Leave it unticked to text them the email wording." />
          {smsOn ? (
            <>
              <DetailButtons vars={vars} label="Details you can add to the text" onAdd={(k) => insertAt('sms_body', sms, setSms, k)} />
              <TextArea name="sms_body" label="Text message" rows={5} value={sms} onChange={setSms} maxLength={1000}
                hint="Texts have no subject, so start with what it is about." />
            </>
          ) : null}
          <p className="small muted" aria-live="polite" style={{ marginTop: smsOn ? -8 : 0 }}>
            {smsOn ? '' : 'Texts use the email message. '}{countLine(texts(fill(textNow, samples)))}
          </p>
        </ActionForm>
      </section>

      <div className="a-side">
        <section className="a-panel" aria-labelledby="prev-h">
          <h2 id="prev-h">Preview</h2>
          <p className="hint">With example details. Updates as you type.</p>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Email</p>
          <div className="card-pale" style={{ borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontWeight: 700, margin: '0 0 10px' }}>{fill(subject, samples)}</p>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>{fill(body, samples)}</p>
          </div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Text message</p>
          <div className="sms-bubble">{fill(textNow, samples)}</div>
        </section>
        <section className="a-panel" aria-labelledby="test-h">
          <h2 id="test-h">Send a test</h2>
          <p className="hint">Sends the wording on screen, even if not saved yet, with example details. An email address gets the email
            (with “[Test]” in the subject); a mobile number gets the text message.</p>
          <ActionForm action={test} submitLabel="Send test" submitClass="btn btn-outline"
            success={(d) => <div className="success"><p style={{ margin: 0 }}>{d}</p></div>}>
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="body" value={body} />
            {smsOn ? <><input type="hidden" name="sms_on" value="on" /><input type="hidden" name="sms_body" value={sms} /></> : null}
            <TextField name="to" label="Email or mobile" autoComplete="off" />
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
