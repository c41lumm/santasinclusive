'use client';
import Script from 'next/script';
import {
  createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState,
  type InputHTMLAttributes, type ReactNode,
} from 'react';
import type { FormState } from '@/lib/forms';

const Errors = createContext<FormState['errors']>(undefined);
const errorFor = (errors: FormState['errors'], field: string) => errors?.find((e) => e.field === field)?.message;

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * A form that sends to a server action. Problems are listed at the top (focused, so screen readers announce
 * them) and next to each field. The form is not cleared after a problem, so nothing typed is lost.
 */
export function ActionForm({ action, submitLabel, children, turnstile = true, secondary, success }: {
  action: Action; submitLabel: string; children: ReactNode; turnstile?: boolean; secondary?: ReactNode;
  /** Shown in place of the form once the action reports it is done */
  success?: (done: string) => ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const done = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.errors?.length) return;
    summary.current?.focus();
    setAttempt((a) => a + 1); // a Turnstile token works once, so get a fresh one
  }, [state]);
  useEffect(() => { if (state.done) done.current?.focus(); }, [state.done]);

  if (state.done && success) {
    return <div ref={done} tabIndex={-1} role="status" className="success">{success(state.done)}</div>;
  }

  return (
    <Errors.Provider value={state.errors}>
      <form noValidate onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => dispatch(fd));
      }}>
        {state.errors?.length ? (
          <div ref={summary} tabIndex={-1} role="alert" className="error-summary">
            <h2>Please check the form</h2>
            <ul>
              {state.errors.map((e) => (
                <li key={`${e.field}:${e.message}`}>{e.field ? <a href={`#${e.field}`}>{e.message}</a> : e.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {children}
        {turnstile ? <Turnstile resetKey={attempt} /> : null}
        <div className="actions">
          <button type="submit" className="button" disabled={pending} aria-disabled={pending}>
            {pending ? 'Sending…' : submitLabel}
          </button>
          {secondary}
        </div>
      </form>
    </Errors.Provider>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="field-error"><span className="visually-hidden">Problem: </span>{message}</p> : null;
}

type TextProps = { name: string; id?: string; label: ReactNode; hint?: ReactNode; optional?: boolean; width?: 'short' | 'medium' }
  & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'id'>;

/** A labelled text box. `id` defaults to `name`, which error summary links use. */
export function TextField({ name, id = name, label, hint, optional, width, ...input }: TextProps) {
  const errors = useContext(Errors);
  const error = errorFor(errors, id);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}{optional ? <span className="optional"> (optional)</span> : null}</label>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      <input id={id} name={name} className={width ? `width-${width}` : undefined} aria-invalid={!!error || undefined}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined} {...input} />
    </div>
  );
}

export function TextArea({ name, id = name, label, hint, optional, defaultValue, value, onChange, rows = 3, maxLength }: {
  name: string; id?: string; label: ReactNode; hint?: ReactNode; optional?: boolean; defaultValue?: string; rows?: number;
  value?: string; onChange?: (v: string) => void; maxLength?: number;
}) {
  const errors = useContext(Errors);
  const error = errorFor(errors, id);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}{optional ? <span className="optional"> (optional)</span> : null}</label>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      <textarea id={id} name={name} rows={rows} defaultValue={defaultValue} maxLength={maxLength}
        value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} aria-invalid={!!error || undefined}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined} />
    </div>
  );
}

type Choice = { value: string; label: ReactNode; hint?: ReactNode };

/** Radios or checkboxes in a fieldset. Controlled when `value`/`values` and `onChange` are given. */
export function Choices({ type, name, id = name, legend, hint, choices, defaultValue, values, onChange, inline, optional }: {
  type: 'radio' | 'checkbox'; name: string; id?: string; legend: ReactNode; hint?: ReactNode; choices: readonly Choice[];
  defaultValue?: string | string[]; values?: string[]; onChange?: (values: string[]) => void; inline?: boolean; optional?: boolean;
}) {
  const errors = useContext(Errors);
  const error = errorFor(errors, id);
  const uid = useId();
  const defaults = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  return (
    <fieldset id={id} tabIndex={-1} className={`field choices${inline ? ' inline' : ''}${error ? ' has-error' : ''}`}
      aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined}>
      <legend>{legend}{optional ? <span className="optional"> (optional)</span> : null}</legend>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      {choices.map((c, i) => {
        const cid = `${uid}-${i}`;
        const checked = values ? values.includes(c.value) : undefined;
        return (
          <div className="choice" key={c.value}>
            <input type={type} id={cid} name={name} value={c.value}
              defaultChecked={values ? undefined : defaults.includes(c.value)} checked={checked}
              onChange={onChange ? (e) => {
                const current = values ?? [];
                if (type === 'radio') onChange([c.value]);
                else onChange(e.target.checked ? [...current, c.value] : current.filter((v) => v !== c.value));
              } : undefined} />
            <label htmlFor={cid}>{c.label}{c.hint ? <span className="hint">{c.hint}</span> : null}</label>
          </div>
        );
      })}
    </fieldset>
  );
}

/** A single tick box, for agreements */
export function Tick({ name, label, hint }: { name: string; label: ReactNode; hint?: ReactNode }) {
  const errors = useContext(Errors);
  const error = errorFor(errors, name);
  return (
    <div className={`field choice-single${error ? ' has-error' : ''}`}>
      <FieldError id={`${name}-error`} message={error} />
      <div className="choice">
        <input type="checkbox" id={name} name={name} aria-invalid={!!error || undefined}
          aria-describedby={[hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') || undefined} />
        <label htmlFor={name}>{label}{hint ? <span id={`${name}-hint`} className="hint">{hint}</span> : null}</label>
      </div>
    </div>
  );
}

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void } }
}

/** Cloudflare's check that the form is sent by a person. It adds a hidden cf-turnstile-response field. */
function Turnstile({ resetKey }: { resetKey: number }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (window.turnstile) setReady(true); }, []);
  useEffect(() => {
    if (!ready || !siteKey || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, { sitekey: siteKey, theme: 'light' });
    return () => window.turnstile?.remove(id);
  }, [ready, siteKey, resetKey]);
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} />
      <div ref={box} className="turnstile" />
    </>
  );
}

export function Select({ name, id = name, label, hint, options, defaultValue, placeholder }: {
  name: string; id?: string; label: ReactNode; hint?: ReactNode; options: { value: string; label: string }[];
  defaultValue?: string; placeholder?: string;
}) {
  const errors = useContext(Errors);
  const error = errorFor(errors, id);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      <select id={id} name={name} defaultValue={defaultValue ?? ''} aria-invalid={!!error || undefined}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined}>
        {placeholder ? <option value="" disabled>{placeholder}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
