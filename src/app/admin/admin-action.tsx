'use client';
import { ActionForm } from '@/components/form';
import type { FormState } from '@/lib/forms';

/** A one-button form that shows its result, for server pages (they cannot pass the success callback themselves) */
export function OneButton({ action, label }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; label: string }) {
  return (
    <ActionForm action={action} submitLabel={label}
      success={(t) => <p role="status" className="tag tag-green" style={{ fontSize: '0.95rem', padding: '10px 16px', margin: 0, whiteSpace: 'normal' }}>{t}</p>}>{null}</ActionForm>
  );
}
