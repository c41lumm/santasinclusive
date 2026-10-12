'use client';
import { ActionForm } from '@/components/form';
import type { FormState } from '@/lib/forms';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function ClaimButtons({ claim, decline }: { claim: Action; decline: Action }) {
  return (
    <>
      <ActionForm action={claim} submitLabel="Claim this slot" block submitClass="btn btn-green">{null}</ActionForm>
      <div style={{ marginTop: 10 }}>
        <ActionForm action={decline} submitLabel="No thanks, keep me on the list" block submitClass="btn btn-quiet"
          success={() => (
            <div className="success" style={{ margin: 0 }}>
              <p>Thank you. We have offered this time to the next family, and you are still on the waitlist for other times that day.</p>
            </div>
          )}>{null}</ActionForm>
      </div>
    </>
  );
}
