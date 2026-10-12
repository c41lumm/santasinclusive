'use client';
import {
  createContext, startTransition, useActionState, useContext, useEffect, useId, useRef,
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
export function ActionForm({ action, submitLabel, children, secondary, success, block, submitClass = 'btn' }: {
  action: Action; submitLabel: string; children: ReactNode; secondary?: ReactNode;
  /** Shown in place of the form once the action reports it is done */
  success?: (done: string) => ReactNode;
  /** Full-width submit button, as on the longer forms in the designs */
  block?: boolean;
  submitClass?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.errors?.length) summary.current?.focus(); }, [state]);
  useEffect(() => { if (state.done) done.current?.focus(); }, [state.done]);

  if (state.done && success) {
    return <div ref={done} tabIndex={-1} role="status">{success(state.done)}</div>;
  }

  return (
    <Errors.Provider value={state.errors}>
      <form noValidate onSubmit={(e) => {
        e.preventDefault();
        // Include the button pressed, for forms with two (such as "Save and come back later")
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
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
        <div className="form-actions" style={block ? { display: 'block' } : undefined}>
          <button type="submit" className={`${submitClass}${block ? ' btn-block' : ''}`} disabled={pending} aria-disabled={pending}>
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

/** "(required)" in red or "(optional)" in grey after a label, as in the designs. `mark={false}` shows neither. */
function Mark({ optional, mark = true }: { optional?: boolean; mark?: boolean }) {
  if (!mark) return null;
  return optional ? <span className="optional"> (optional)</span> : <span className="req"> (required)</span>;
}

const describedBy = (id: string, hint: unknown, error: unknown) =>
  [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

type TextProps = {
  name: string; id?: string; label: ReactNode; hint?: ReactNode; optional?: boolean; mark?: boolean; width?: 'short' | 'medium';
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'id'>;

/** A labelled text box. `id` defaults to `name`, which error summary links use. */
export function TextField({ name, id = name, label, hint, optional, mark, width, ...input }: TextProps) {
  const error = errorFor(useContext(Errors), id);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}<Mark optional={optional} mark={mark} /></label>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      <input id={id} name={name} type={input.type ?? 'text'} className={width ? `width-${width}` : undefined}
        aria-invalid={!!error || undefined} aria-describedby={describedBy(id, hint, error)} {...input} />
    </div>
  );
}

export function TextArea({ name, id = name, label, hint, optional, mark, defaultValue, value, onChange, rows = 3, maxLength, placeholder }: {
  name: string; id?: string; label: ReactNode; hint?: ReactNode; optional?: boolean; mark?: boolean; defaultValue?: string;
  rows?: number; value?: string; onChange?: (v: string) => void; maxLength?: number; placeholder?: string;
}) {
  const error = errorFor(useContext(Errors), id);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}<Mark optional={optional} mark={mark} /></label>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      <textarea id={id} name={name} rows={rows} defaultValue={defaultValue} maxLength={maxLength} placeholder={placeholder}
        value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={!!error || undefined} aria-describedby={describedBy(id, hint, error)} />
    </div>
  );
}

type Choice = { value: string; label: ReactNode; hint?: ReactNode };

/** Radios or checkboxes in a fieldset. Controlled when `values` and `onChange` are given. */
export function Choices({ type, name, id = name, legend, hint, choices, defaultValue, values, onChange, layout, optional, mark }: {
  type: 'radio' | 'checkbox'; name: string; id?: string; legend: ReactNode; hint?: ReactNode; choices: readonly Choice[];
  defaultValue?: string | string[]; values?: string[]; onChange?: (values: string[]) => void;
  layout?: 'inline' | 'grid'; optional?: boolean; mark?: boolean;
}) {
  const error = errorFor(useContext(Errors), id);
  const uid = useId();
  const defaults = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  return (
    <fieldset id={id} tabIndex={-1} className={`field choices${layout ? ` ${layout}` : ''}${error ? ' has-error' : ''}`}
      aria-describedby={describedBy(id, hint, error)}>
      <legend>{legend}<Mark optional={optional} mark={mark} /></legend>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      <div className="options">
        {choices.map((c, i) => {
          const cid = `${uid}-${i}`;
          return (
            <div className={`choice${c.hint ? ' has-hint' : ''}`} key={c.value}>
              <input type={type} id={cid} name={name} value={c.value}
                defaultChecked={values ? undefined : defaults.includes(c.value)} checked={values ? values.includes(c.value) : undefined}
                onChange={onChange ? (e) => {
                  const current = values ?? [];
                  if (type === 'radio') onChange([c.value]);
                  else onChange(e.target.checked ? [...current, c.value] : current.filter((v) => v !== c.value));
                } : undefined} />
              <label htmlFor={cid}>{c.label}{c.hint ? <span className="hint">{c.hint}</span> : null}</label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A single tick box, for agreements. Required unless `optional`. */
export function Tick({ name, label, hint, optional, checked, onChange }: {
  name: string; label: ReactNode; hint?: ReactNode; optional?: boolean; checked?: boolean; onChange?: (v: boolean) => void;
}) {
  const error = errorFor(useContext(Errors), name);
  return (
    <div className={`field${error ? ' has-error' : ''}`} style={{ marginBottom: 12 }}>
      <FieldError id={`${name}-error`} message={error} />
      <div className="agree">
        <input type="checkbox" id={name} name={name} aria-invalid={!!error || undefined}
          checked={checked} onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          aria-describedby={describedBy(name, hint, error)} />
        <label htmlFor={name}>{label}{optional ? null : <span className="req"> (required)</span>}
          {hint ? <span id={`${name}-hint`} className="hint" style={{ marginTop: 4 }}>{hint}</span> : null}</label>
      </div>
    </div>
  );
}

export function Select({ name, id = name, label, hint, options, defaultValue, value, onChange, placeholder, optional, mark, width }: {
  name: string; id?: string; label: ReactNode; hint?: ReactNode; options: { value: string; label: string }[];
  defaultValue?: string; value?: string; onChange?: (v: string) => void; placeholder?: string; optional?: boolean; mark?: boolean;
  width?: 'short' | 'medium';
}) {
  const error = errorFor(useContext(Errors), id);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}<Mark optional={optional} mark={mark} /></label>
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
      <select id={id} name={name} className={width ? `width-${width}` : undefined}
        defaultValue={value === undefined ? (defaultValue ?? '') : undefined} value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={!!error || undefined} aria-describedby={describedBy(id, hint, error)}>
        {placeholder ? <option value="" disabled>{placeholder}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
