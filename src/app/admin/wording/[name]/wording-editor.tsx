'use client';
import { useState } from 'react';
import { ActionForm, TextArea, TextField } from '@/components/form';
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

export function WordingEditor({ name, subject: s0, body: b0, original, vars, save, test }: {
  name: TemplateName; subject: string; body: string; original: { subject: string; body: string };
  vars: Var[]; save: Action; test: Action;
}) {
  const [subject, setSubject] = useState(s0);
  const [body, setBody] = useState(b0);
  const samples = sampleVars(name);
  const t = texts(fill(body, samples));
  const changed = subject !== s0 || body !== b0;

  const insert = (key: string) => {
    const el = document.getElementById('body') as HTMLTextAreaElement | null;
    const token = `{${key}}`;
    const at = el?.selectionStart ?? body.length, end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, at) + token + body.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  };

  return (
    <div className="a-split" style={{ alignItems: 'flex-start' }}>
      <section className="a-panel a-main" aria-labelledby="edit-h">
        <h2 id="edit-h">Wording</h2>
        <ActionForm action={save} submitLabel="Save wording"
          success={(d) => <div className="success"><p style={{ fontWeight: 700 }}>{d}</p><p style={{ margin: 0 }}><a href={`/admin/wording/${name}`}>Back to this message</a> · <a href="/admin/wording">All messages</a></p></div>}
          secondary={changed ? <button type="button" className="btn btn-plain" onClick={() => { setSubject(s0); setBody(b0); }}>Undo changes</button> : null}>
          <TextField name="subject" label="Email subject" hint="Texts do not show a subject." value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          {vars.length ? (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Add a detail</p>
              <p className="hint" style={{ margin: '0 0 8px' }}>Each one is filled in for the person it goes to. Starred ones must stay in the message.</p>
              <div className="a-chips" role="group" aria-label="Details you can add">
                {vars.map((v) => (
                  <button key={v.key} type="button" className="chip" onClick={() => insert(v.key)} aria-label={`Add ${v.label}${v.required ? ', must stay in the message' : ''}`}>
                    {v.label}{v.required ? ' *' : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <TextArea name="body" label="Message" rows={10} value={body} onChange={setBody} maxLength={2000}
            hint={<>The details show as {'{name}'} and so on here. Press Enter for a new line.</>} />
          <p className="small muted" aria-live="polite" style={{ marginTop: -8 }}>
            {t.len} characters. As a text this is {t.count === 1 ? '1 text' : `${t.count} texts`}{!t.plain ? ' (emoji and some symbols make texts shorter)' : ''}.
          </p>
          {body !== original.body || subject !== original.subject ? (
            <details style={{ marginBottom: 16 }}>
              <summary>See the original wording</summary>
              <p style={{ fontWeight: 700, margin: '8px 0 4px' }}>{original.subject}</p>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{original.body}</p>
            </details>
          ) : null}
        </ActionForm>
      </section>

      <div className="a-side">
        <section className="a-panel" aria-labelledby="prev-h">
          <h2 id="prev-h">Preview</h2>
          <p className="hint">With example details. Updates as you type.</p>
          <div className="card-pale" style={{ borderRadius: 16, padding: '14px 16px' }}>
            <p style={{ fontWeight: 700, margin: '0 0 10px' }}>{fill(subject, samples)}</p>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>{fill(body, samples)}</p>
          </div>
        </section>
        <section className="a-panel" aria-labelledby="test-h">
          <h2 id="test-h">Send a test</h2>
          <p className="hint">Sends the wording on screen, even if not saved yet, with example details and “[Test]” in the subject.</p>
          <ActionForm action={test} submitLabel="Send test" submitClass="btn btn-outline"
            success={(d) => <div className="success"><p style={{ margin: 0 }}>{d}</p></div>}>
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="body" value={body} />
            <TextField name="to" label="Email or mobile" autoComplete="off" />
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
