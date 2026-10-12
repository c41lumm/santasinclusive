import type { Metadata } from 'next';
import { GroupForm } from './group-form';

export const metadata: Metadata = { title: 'Schools and groups' };

export default function Groups() {
  return (
    <div className="content">
      <h1>Schools and groups</h1>
      <p className="lead">
        Special schools, charities, day centres and other groups are very welcome. Tell us about your group and we will
        find a time that works for you.
      </p>
      <GroupForm />
    </div>
  );
}
