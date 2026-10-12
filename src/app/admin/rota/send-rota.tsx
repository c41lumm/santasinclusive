'use client';
import { ActionForm } from '@/components/form';
import type { FormState } from '@/lib/forms';

export function SendRota({ action }: { action: (prev: FormState, fd: FormData) => Promise<FormState> }) {
  return (
    <ActionForm action={action} submitLabel="Send this week's rota"
      success={(t) => <p role="status" className="tag tag-green" style={{ fontSize: '0.95rem', padding: '10px 16px', margin: 0 }}>{t}</p>}>{null}</ActionForm>
  );
}
