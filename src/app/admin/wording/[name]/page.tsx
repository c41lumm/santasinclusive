import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { isTemplateName, messageDefs, placeholders } from '@/lib/notify/templates';
import { savedWording } from '@/lib/notify/wording';
import { resetWording, saveWording, sendTestWording } from '../actions';
import { WordingEditor } from './wording-editor';

export const metadata: Metadata = { title: 'Edit message wording' };

export default async function EditWording({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ reset?: string }> }) {
  await requireStaff(['admin']);
  const { name } = await params;
  const { reset } = await searchParams;
  if (!isTemplateName(name)) notFound();
  const def = messageDefs[name];
  const saved = (await savedWording()).get(name);
  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/admin/wording">← All messages</Link></p>
      <div className="admin-head">
        <div>
          <h1>{def.label}</h1>
          <p>{def.when}</p>
        </div>
        {saved ? (
          <form action={resetWording.bind(null, name)}>
            <button type="submit" className="btn btn-outline btn-sm">Reset to original wording</button>
          </form>
        ) : <span className="tag tag-grey">Original wording</span>}
      </div>
      {reset && !saved ? <p className="notice" role="status">Back to the original wording.</p> : null}
      {/* A fresh editor only after a reset, so a save keeps showing its "Saved" message */}
      <WordingEditor key={reset ?? 'edit'} name={name}
        subject={saved?.subject ?? def.subject} body={saved?.body ?? def.body}
        original={{ subject: def.subject, body: def.body }}
        vars={def.vars.map((k) => ({ key: k, label: placeholders[k].label, required: (def.required as readonly string[]).includes(k) }))}
        save={saveWording.bind(null, name)} test={sendTestWording.bind(null, name)} />
    </>
  );
}
