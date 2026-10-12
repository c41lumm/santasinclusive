import type { Metadata } from 'next';
import { SupportForm } from './support-form';

export const metadata: Metadata = { title: 'Sponsor a gift' };

export default function Support() {
  return (
    <div className="content">
      <h1>Sponsor gifts</h1>
      <p className="lead">
        Every visitor leaves with a gift from Santa. Businesses and organisations can sponsor gifts, and we will thank
        you on our sponsors&apos; wall if you would like.
      </p>
      <SupportForm />
    </div>
  );
}
