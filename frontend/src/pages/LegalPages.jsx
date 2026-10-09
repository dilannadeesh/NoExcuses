import { Link } from "react-router-dom";
import BrandMark, { Wordmark } from "../components/BrandMark";

// Public pages (no login) required for Google Play: a privacy policy and a
// way to request account deletion. Set VITE_SUPPORT_EMAIL at build time to
// show a contact address on both.
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
const UPDATED = "9 October 2026";

function Contact() {
  return SUPPORT_EMAIL ? (
    <a className="font-semibold text-ink underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span className="font-semibold">the support email listed on our Google Play page</span>
  );
}

function LegalLayout({ title, children }) {
  return (
    <div className="min-h-screen px-5 pb-16 pt-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/" className="mb-8 flex items-center gap-3" aria-label="NoExcuses Badminton home">
          <BrandMark size={36} />
          <Wordmark className="text-lg" />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ink [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_ul>li]:ml-5 [&_ul>li]:list-disc [&_li]:py-0.5">
          {children}
        </div>
        <p className="mt-10 text-sm text-muted">
          <Link to="/privacy" className="underline underline-offset-4">Privacy policy</Link>
          {" · "}
          <Link to="/delete-account" className="underline underline-offset-4">Delete your account</Link>
        </p>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>
        NoExcuses Badminton (“we”, “the app”) helps badminton groups log games, rank players and plan sessions. It
        is available as a website (www.noexcusesbadminton.com) and an Android app that shows the same service. This
        policy explains what we collect and why.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your name and email address, and a password (stored only as a one-way hash — we cannot read it).</li>
          <li><b>Group data you or your group admins enter:</b> groups you belong to, other members’ names and emails (added by a group admin), games, set scores, tournaments and “today’s games” schedules.</li>
          <li><b>Session cookie:</b> a secure, essential cookie that keeps you logged in.</li>
          <li>
            <b>Usage and error analytics (Google Analytics 4):</b> which screens you open, which buttons or forms you use,
            error messages shown, how fast requests are, whether you use the web or the Android app, and your internal
            account number. We do not send your name, email, password or free-text input to analytics, and advertising
            features are switched off.
          </li>
        </ul>
        <p className="mt-2">We do not collect your location, contacts, photos, microphone or camera data, and we do not show ads.</p>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run the service: sign you in, show your groups, rankings and schedules to the people you play with.</li>
          <li>To send emails you ask for, such as password reset links.</li>
          <li>To find and fix problems and understand where people get stuck, using aggregated analytics.</li>
        </ul>
      </section>

      <section>
        <h2>Who can see your data</h2>
        <p>
          Other members of a group you belong to can see that group’s members, games, rankings and schedules. Group
          owners and admins can add or remove members. We do not sell your data. Service providers process it on our
          behalf: Vercel (hosting), Neon (database), Resend (email delivery) and Google (analytics).
        </p>
      </section>

      <section>
        <h2>Keeping and deleting data</h2>
        <p>
          We keep your data while your account exists. You can ask us to delete it at any time — see{" "}
          <Link to="/delete-account" className="font-semibold underline underline-offset-4">Delete your account</Link>.
          Passwords are hashed and connections are encrypted (HTTPS).
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>The app is not directed to children under 13, and we do not knowingly collect their data.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this policy and will change the date above when we do. Questions or requests: <Contact />.
        </p>
      </section>
    </LegalLayout>
  );
}

export function DeleteAccountPage() {
  const subject = encodeURIComponent("Delete my NoExcuses account");
  const body = encodeURIComponent("Please delete my NoExcuses Badminton account.\n\nAccount email: ");
  return (
    <LegalLayout title="Delete your account">
      <p>
        You can ask us to delete your NoExcuses Badminton account and personal data at any time. This works the same
        whether you use the website or the Android app.
      </p>

      <section>
        <h2>How to request deletion</h2>
        <ol className="ml-5 list-decimal space-y-1 [&>li]:list-decimal">
          <li>
            Email <Contact /> from the address you signed up with
            {SUPPORT_EMAIL && (
              <>
                {" "}(or{" "}
                <a
                  className="font-semibold underline underline-offset-4"
                  href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
                >
                  tap here to start the email
                </a>
                )
              </>
            )}
            , with the subject “Delete my NoExcuses account”.
          </li>
          <li>We confirm it is you, then delete the account — normally within 30 days.</li>
        </ol>
      </section>

      <section>
        <h2>What gets deleted</h2>
        <ul>
          <li>Your name, email address, password hash, login sessions and group memberships.</li>
          <li>
            Games you played in were recorded by your group. So everyone’s statistics stay correct, those game records
            may stay, but your name and email are removed and shown as “Deleted player”.
          </li>
          <li>If you own a group, we first agree with you whether to hand it to another member or delete it.</li>
          <li>Analytics events are tied only to an internal number, not to your name or email, and expire under Google Analytics’ own retention settings.</li>
        </ul>
      </section>
    </LegalLayout>
  );
}
