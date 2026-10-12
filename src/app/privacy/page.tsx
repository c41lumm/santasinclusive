import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How we look after your details' };

// Check this page with your adviser before booking opens (see README).
export default function Privacy() {
  const email = process.env.EMAIL_FROM;
  return (
    <div className="content">
      <h1>How we look after your details</h1>
      <p className="lead">
        Santa&apos;s Inclusive Grotto is run by Liquid New Media Limited, which is responsible for your details (the data
        controller).
      </p>

      <h2>What we hold and why</h2>
      <ul>
        <li><strong>Your contact details</strong>, to send your booking, reminders and any changes.</li>
        <li><strong>Who is coming</strong>, and anything you tell us about them, so Santa and our elves can make the visit right for them.</li>
        <li>
          <strong>Health and support needs</strong>, only if you choose to tell us, so we can keep everyone safe and
          comfortable. We hold these because you agree to it, and you can ask us to remove them at any time.
        </li>
        <li><strong>Your postcode and address</strong>, if you give them, only to make sure each family gets one visit.</li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>Our organiser and lead elf can see everything, to plan your visit.</li>
        <li>Our elves can see names and the needs you tell us about, but not health details or contact details.</li>
        <li>Santa sees only first names, ages, how to say hello, what each visitor loves and dislikes, and how they would like to meet.</li>
      </ul>
      <p>We never sell your details or use them for marketing.</p>

      <h2>Where it is kept</h2>
      <p>
        Your details are stored in the European Union (Frankfurt, Germany), with Neon, our database provider, and Vercel,
        which runs this website. Messages are sent through SendGrid (email) and Twilio (texts and WhatsApp), which are
        based in the United States and handle your email address or phone number to deliver them.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We delete visitor details, health details, contact details and messages in January, after the season. We keep
        the number of visits, without names, so we can plan next year. Photos you have agreed we can share may be kept
        and used after the season; photos for your family only are deleted.
      </p>

      <h2>Photos</h2>
      <p>We only take photos if you say yes, and you can change your mind at any time from your booking page.</p>

      <h2 id="contact">Your rights and contacting us</h2>
      <p>
        You can ask to see, correct or delete your details, or withdraw your agreement, at any time.{' '}
        {email ? <>Email us at <a href={`mailto:${email}`}>{email}</a>.</> : <>Reply to any message we have sent you.</>}
      </p>
      <p>
        If you are unhappy with how we have handled your details, you can complain to the Information Commissioner&apos;s
        Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>.
      </p>
    </div>
  );
}
