import { Link } from "react-router-dom";
import BrandMark, { Wordmark } from "../components/BrandMark";
import DeleteAccountForm from "../components/DeleteAccountForm";
import { useAuth } from "../context/AuthContext";

// Public pages (no login) required for Google Play: a privacy policy and a
// way to request account deletion. Set VITE_SUPPORT_EMAIL at build time to
// show a contact address on both.
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
const UPDATED = "23 October 2026";

function Contact() {
  return SUPPORT_EMAIL ? (
    <a className="font-semibold text-ink underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span className="font-semibold">the support email listed on our App Store or Google Play page</span>
  );
}

function LegalLayout({ title, children, showUpdated = true, showFooter = true }) {
  return (
    <div className="min-h-screen px-5 pb-16 pt-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/" className="mb-8 flex items-center gap-3" aria-label="NoExcuses Badminton home">
          <BrandMark size={36} />
          <Wordmark />
        </Link>
        <h1 className="display text-[40px]">{title}</h1>
        {showUpdated && <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>}
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ink [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:italic [&_h2]:uppercase [&_h2]:text-lime [&_ul>li]:ml-5 [&_ul>li]:list-disc [&_li]:py-0.5">
          {children}
        </div>
        {showFooter && <p className="mt-10 text-sm text-muted">
          <Link to="/privacy" className="underline underline-offset-4">Privacy policy</Link>
          {" · "}
          <Link to="/terms" className="underline underline-offset-4">Terms of service</Link>
          {" · "}
          <Link to="/support" className="underline underline-offset-4">Support</Link>
          {" · "}
          <Link to="/delete-account" className="underline underline-offset-4">Delete your account</Link>
        </p>}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>
        NoExcuses Badminton (“we”, “the app”) helps badminton groups log games, rank players and plan sessions. It
        is available as a website (www.noexcusesbadminton.com) and iPhone and Android apps that show the same service. This
        policy explains what we collect and why.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your name and email address, and a password (stored only as a one-way hash — we cannot read it).</li>
          <li><b>Group data you or your group admins enter:</b> groups you belong to, other members’ names and emails (added by a group admin), games, set scores, tournaments, “today’s games” schedules and shared expenses (amounts, descriptions, who paid, who shares them and when someone settles up).</li>
          <li><b>Push notification token:</b> if you allow notifications in the phone app, a device token so we can tell you when someone settles up with you. It is deleted when you log out or delete your account.</li>
          <li><b>Session cookie:</b> a secure, essential cookie that keeps you logged in.</li>
          <li>
            <b>Usage and error analytics (Google Analytics 4):</b> which screens you open, which buttons or forms you use,
            error messages shown, how fast requests are, whether you use the web, iPhone or Android app, and your internal
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
            <li>
              To tell you when a group admin adds you to a group: we send one email to the address they entered, saying who
              added you and how to join. If you don’t sign up, nothing else is sent. Ask us and we’ll delete your details.
            </li>
            <li>To review reports of content or behaviour that break our rules.</li>
          <li>To find and fix problems and understand where people get stuck, using aggregated analytics.</li>
        </ul>
      </section>

      <section>
        <h2>Who can see your data</h2>
        <p>
          Other members of a group you belong to can see that group’s members, games, rankings, schedules and expenses. Group
          owners and admins can add or remove members, and you can leave any group you don’t own from its Members screen. We do not sell your data. Service providers process it on our
          behalf: Vercel (hosting), Neon (database), Resend (email delivery), Apple (push notifications) and Google (analytics).
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
  const { user } = useAuth();
  const subject = encodeURIComponent("Delete my NoExcuses account");
  const body = encodeURIComponent("Please delete my NoExcuses Badminton account.\n\nAccount email: ");
  return (
    <LegalLayout title="Delete your account">
      <p>
        You can delete your NoExcuses Badminton account and personal data at any time, yourself, inside the app or
        on the website. It works the same on iPhone, Android and the web.
      </p>

      <section>
        <h2>Delete it yourself</h2>
        {user ? (
          <div className="not-prose"><DeleteAccountForm /></div>
        ) : (
          <ol className="ml-5 list-decimal space-y-1 [&>li]:list-decimal">
            <li><Link className="font-semibold underline underline-offset-4" to="/login" state={{ from: "/delete-account" }}>Log in</Link>.</li>
            <li>Open the <strong>Profile</strong> tab and tap <strong>Delete my account</strong> (or come back to this page).</li>
            <li>Enter your password and confirm. Your account is deleted straight away.</li>
          </ol>
        )}
      </section>

      <section>
        <h2>Can’t log in?</h2>
        <p>
          Email <Contact /> from the address you signed up with
          {SUPPORT_EMAIL && (
            <>
              {" "}(or{" "}
              <a className="font-semibold underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}>
                tap here to start the email
              </a>
              )
            </>
          )}
          {" "}with the subject “Delete my NoExcuses account”. We confirm it is you, then delete the account — normally
          within 30 days.
        </p>
      </section>

      <section>
        <h2>What gets deleted</h2>
        <ul>
          <li>Your name, email address, password, login sessions and group memberships.</li>
          <li>
            Games you played in were recorded by your group. So everyone’s statistics stay correct, those game records
            stay, but your name and email are removed and shown as “Deleted player”. The same applies to group expenses you
            paid or shared, so what other members owe stays correct.
          </li>
          <li>If you own a group, it is handed to another member — or deleted if you are the only member.</li>
          <li>Analytics events are tied only to an internal number, not to your name or email, and expire under Google Analytics’ own retention settings.</li>
        </ul>
      </section>
    </LegalLayout>
  );
}

export function SupportPage() {
  const subject = encodeURIComponent("NoExcuses Badminton support");
  const topics = [
    "Account access",
    "Group management",
    "Match results",
    "Rankings",
    "Technical problems",
    "Feedback and feature requests",
  ];
  return (
    <LegalLayout title="NoExcuses Badminton Support" showUpdated={false} showFooter={false}>
      <p className="text-lg text-muted">Need help with your account, group, games or rankings?</p>

      <section className="card space-y-3 p-5">
        <p>
          <span className="text-muted">Email: </span>
          {SUPPORT_EMAIL ? (
            <a className="font-semibold text-ink underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}>
              {SUPPORT_EMAIL}
            </a>
          ) : (
            <span className="font-semibold">support email coming soon</span>
          )}
        </p>
        <p>
          <span className="text-muted">Response time: </span>
          <span className="font-semibold">Usually within 1–2 business days</span>
        </p>
      </section>

      <section>
        <h2>You can contact us regarding</h2>
        <ul>
          {topics.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted">
        <Link to="/privacy" className="font-semibold underline underline-offset-4">Privacy Policy</Link>
        {" · "}
        <Link to="/terms" className="font-semibold underline underline-offset-4">Terms of Service</Link>
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of service">
      <p>
        These terms cover your use of NoExcuses Badminton (“the service”) on the website, iPhone and Android apps. By
        creating an account or using the service you agree to them. If you don’t agree, please don’t use it.
      </p>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must give a real email address and keep your password to yourself. You’re responsible for what happens under your account.</li>
          <li>You must be at least 13 years old.</li>
          <li>You can delete your account at any time from the Profile tab. See our <Link to="/privacy" className="font-semibold underline underline-offset-4">Privacy policy</Link> for how data is handled.</li>
        </ul>
      </section>

      <section>
        <h2>Groups, games and scores</h2>
        <ul>
          <li>Group expenses are a bookkeeping aid between members only. The app does not move money, and members settle up themselves.</li>
          <li>Group owners and admins manage their group: they add and remove members and can edit or delete logged games and tournaments.</li>
          <li>Scores and rankings are entered by group members. We don’t verify them and aren’t responsible for disputes between players.</li>
          <li>Other members of your group can see your name, email and results in that group.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don’t use the service to harass others, post unlawful or offensive names, or enter other people’s details without their agreement.</li>
          <li>Don’t try to break, overload or gain unauthorised access to the service or other people’s accounts.</li>
          <li>We may suspend or remove accounts or groups that break these rules.</li>
        </ul>
      </section>

      <section>
        <h2>Reporting and blocking</h2>
        <ul>
          <li>
            We don’t tolerate offensive content or abusive behaviour. Report anything that breaks these rules from a
            group’s <b>Members</b> screen (<b>Report a problem</b>) or through <Link to="/support" className="underline underline-offset-4">Support</Link>.
          </li>
          <li>We review every report within 24 hours and remove the content, the person or the group when it breaks these rules.</li>
          <li>You can leave any group you don’t own at any time, from its Members screen. Group owners and admins can remove members.</li>
        </ul>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          The service is free and provided “as is”. We work to keep it available and accurate, but we can’t promise it
          will always be uninterrupted or error-free, and features may change. To the extent the law allows, we aren’t
          liable for indirect or consequential losses from using it. Nothing here limits rights you have under the law
          that can’t be waived.
        </p>
      </section>

      <section>
        <h2>Our content</h2>
        <p>
          The NoExcuses Badminton name, logo and software belong to us. The names, scores and other information you
          and your group enter stay yours; you let us store and show them to your group so the service can work.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms and will change the date above when we do. Continuing to use the service means you
          accept the update. Questions: <Contact /> or see <Link to="/support" className="font-semibold underline underline-offset-4">Support</Link>.
        </p>
      </section>
    </LegalLayout>
  );
}
