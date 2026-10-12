import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Accessibility statement' };

export default function Accessibility() {
  return (
    <div className="wrap page"><div className="prose">
      <p className="eyebrow">Accessibility</p>
      <h1 className="green" style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}>Accessibility statement</h1>
      <p className="lead">
        Everyone who visits the grotto should be able to use this website, including people who use screen readers, switch
        access, magnification or voice control, and people who find busy pages hard.
      </p>
      <h2>What we have done</h2>
      <ul>
        <li>Large, clear text in Atkinson Hyperlegible, a typeface designed for readers with low vision.</li>
        <li>Strong colour contrast, and nothing that flashes, moves or plays by itself.</li>
        <li>Every button and form field has a label, and buttons are big enough to tap easily.</li>
        <li>Pages work with a keyboard alone, with a clear outline showing where you are.</li>
        <li>If something in a form needs changing, we list it at the top and next to the question.</li>
        <li>Pages fit phone screens, and text can be made bigger without anything being cut off.</li>
        <li>Our check that forms are sent by a person never asks you to solve a puzzle.</li>
      </ul>
      <h2>Tell us if something does not work for you</h2>
      <p>
        If you find anything hard to use, or need information in another format, please tell us and we will help you book
        another way.{site.contactEmail ? <> Email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</> : null}
      </p>
    </div></div>
  );
}
