'use client';
import { ActionForm, TextArea } from '@/components/form';
import type { FormState } from '@/lib/forms';

export function ReplyForm({ action, to }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; to: string }) {
  return (
    <ActionForm action={action} submitLabel="Send reply"
      success={(t) => <p role="status" className="success" style={{ margin: 0, fontWeight: 700 }}>{t}</p>}>
      <TextArea name="reply" label={`Reply to ${to}`} rows={8} maxLength={10000}
        hint="Their email is quoted underneath your reply automatically." />
    </ActionForm>
  );
}
