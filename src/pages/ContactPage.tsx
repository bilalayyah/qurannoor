import { AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { usePageMetadata } from '../hooks/usePageMetadata';

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT as string | undefined;

export function ContactPage() {
  usePageMetadata({
    title: 'Contact Us – QuranNoor',
    description:
      'Contact QuranNoor.com to report Quran text rendering issues, audio errors, accessibility concerns, or copyright inquiries.',
    canonicalPath: '/contact',
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Feedback');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<{
    type: 'idle' | 'submitting' | 'sent' | 'unconfigured' | 'error';
    text?: string;
  }>({ type: 'idle' });

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim() || name.trim().length < 2) {
      next.name = 'Please enter your name (at least 2 characters).';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (!subject.trim()) {
      next.subject = 'Please select or enter a subject.';
    }
    if (!message.trim() || message.trim().length < 15) {
      next.message = 'Please enter a clear message (at least 15 characters).';
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Anti-spam honeypot check: silently ignore automated bot submissions
    if (honeypot.trim() !== '') {
      return;
    }

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setStatus({
        type: 'error',
        text: 'Please review the highlighted fields before submitting.',
      });
      return;
    }

    // Never simulate form delivery if no real endpoint is configured
    if (!CONTACT_ENDPOINT || !CONTACT_ENDPOINT.trim()) {
      setStatus({
        type: 'unconfigured',
        text: 'Validation passed, but live message delivery is not yet connected. To enable real submissions before or after deployment, configure VITE_CONTACT_ENDPOINT (e.g., a Cloudflare Worker mail handler or form processing endpoint) in your environment settings.',
      });
      return;
    }

    setStatus({ type: 'submitting' });
    try {
      const response = await fetch(CONTACT_ENDPOINT.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          source: 'QuranNoor.com',
        }),
      });

      if (!response.ok) {
        throw new Error(`Submission returned status ${response.status}`);
      }

      setName('');
      setEmail('');
      setMessage('');
      setErrors({});
      setStatus({
        type: 'sent',
        text: 'Your message has been delivered. Thank you for helping improve QuranNoor.',
      });
    } catch (err) {
      setStatus({
        type: 'error',
        text:
          err instanceof Error
            ? `Unable to deliver message (${err.message}). Please try again later.`
            : 'Unable to deliver message. Please try again later.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact Us' }]} />

      <header className="space-y-3 border-b pb-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--gold)' }}>
          QuranNoor.com · Support & Inquiries
        </p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Contact Us
        </h1>
        <p className="font-editorial text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Use this page to report Arabic script rendering issues, audio playback problems,
          accessibility barriers, privacy questions, or copyright and attribution concerns on
          QuranNoor.
        </p>
      </header>

      {!CONTACT_ENDPOINT && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-2xl border p-5 text-sm"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--gold)' }} />
          <div className="space-y-1.5">
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Mail Delivery Configuration Pending
            </p>
            <p className="leading-relaxed">
              This contact form includes full field validation and honeypot spam protection, but no
              mail server or form endpoint is connected in this pre-export workspace. Set{' '}
              <code className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: 'var(--bg-muted)' }}>
                VITE_CONTACT_ENDPOINT
              </code>{' '}
              or attach a Cloudflare Pages Function mail handler before going live on QuranNoor.com.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-2xl border p-6 sm:p-8"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Honeypot anti-spam trap (hidden from real users and screen readers) */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="contact-website">Leave this field empty</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="contact-name"
              className="block text-sm font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              Your Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="contact-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'contact-name-error' : undefined}
              className="w-full min-h-[44px] rounded-xl border px-3.5 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: errors.name ? '#b91c1c' : 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.name && (
              <p id="contact-name-error" className="text-xs text-red-700 dark:text-red-400">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="contact-email"
              className="block text-sm font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              Email Address <span aria-hidden="true">*</span>
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'contact-email-error' : undefined}
              className="w-full min-h-[44px] rounded-xl border px-3.5 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: errors.email ? '#b91c1c' : 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.email && (
              <p id="contact-email-error" className="text-xs text-red-700 dark:text-red-400">
                {errors.email}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="contact-subject"
            className="block text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            Topic / Subject <span aria-hidden="true">*</span>
          </label>
          <select
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border px-3.5 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="General Feedback">General Feedback</option>
            <option value="Quran Text or Diacritic Issue">Quran Text or Diacritic Issue</option>
            <option value="Audio or Reciter Issue">Audio or Reciter Issue</option>
            <option value="Accessibility Concern">Accessibility Concern</option>
            <option value="Privacy or Data Inquiry">Privacy or Data Inquiry</option>
            <option value="Copyright & Attribution">Copyright & Attribution</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="contact-message"
            className="block text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            Message <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="contact-message"
            rows={5}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Include Surah and Ayah numbers (e.g. Surah 2, Ayah 255) if reporting a reading or audio issue..."
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'contact-message-error' : undefined}
            className="w-full rounded-xl border p-3.5 text-sm outline-none leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: errors.message ? '#b91c1c' : 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
          {errors.message && (
            <p id="contact-message-error" className="text-xs text-red-700 dark:text-red-400">
              {errors.message}
            </p>
          )}
        </div>

        {status.type !== 'idle' && status.text && (
          <div
            role={status.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-xl border p-4 text-xs sm:text-sm leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor:
                status.type === 'error'
                  ? '#b91c1c'
                  : status.type === 'sent'
                  ? 'var(--accent)'
                  : 'var(--gold)',
              color: 'var(--text-primary)',
            }}
          >
            {status.type === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
            )}
            <span>{status.text}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
          <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
            <span>Protected by honeypot filtering & client validation (Turnstile-ready).</span>
          </p>

          <button
            type="submit"
            disabled={status.type === 'submitting'}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {status.type === 'submitting' ? 'Sending...' : 'Submit Message'}
          </button>
        </div>
      </form>

      <section
        className="rounded-2xl border p-6 text-sm space-y-2"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Spam Protection & Privacy Note
        </h2>
        <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          When live delivery is configured on Cloudflare Pages, we recommend pairing the endpoint
          with Cloudflare Turnstile verification and server-side rate limiting. Submitted details are
          governed by our{' '}
          <Link to="/privacy-policy" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
