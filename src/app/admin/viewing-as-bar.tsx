import { getStaff, viewingAs } from '@/lib/auth/staff';
import { roleLabel } from '@/lib/helper-roles';
import { stopViewingAs } from './helpers-actions';

/** The orange bar shown on every page while an admin is viewing the site as a helper */
export async function ViewingAsBar() {
  const v = await viewingAs();
  if (!v) return null;
  const me = await getStaff();
  return (
    <div className="viewing-as" role="status">
      <p>
        You&apos;re viewing as <strong>{me?.name ?? 'this helper'}</strong>{me ? ` (${roleLabel(me.role)})` : ''}. Anything you change is done as them.
      </p>
      <form action={stopViewingAs}><button type="submit" className="btn btn-sm">Stop viewing</button></form>
    </div>
  );
}
