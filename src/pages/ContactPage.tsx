import { AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ThemedSelect, type ThemedSelectOption } from '../components/ThemedSelect';
import { usePageMetadata } from '../hooks/usePageMetadata';

const CONTACT_TOPIC_OPTIONS: readonly ThemedSelectOption[] = [
  { value: 'General Feedback', label: 'General Feedback' },
  { value: 'Quran Text or Diacritic Issue', label: 'Quran Text or Diacritic Issue' },
  { value: 'Audio or Reciter Issue', label: 'Audio or Reciter Issue' },
  { value: 'Accessibility Concern', label: 'Accessibility Concern' },
  { value: 'Privacy or Data Inquiry', label: 'Privacy or Data Inquiry' },
  { value: 'Copyright & Attribution', label: 'Copyright & Attribution' },
];

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

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
    type: 'idle' | 'submitting' | 'sent' | 'error';
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

    // Messages are delivered through the server-side /api/contact Pages
    // Function, which holds the delivery destination in an environment
    // variable — no endpoint or email address lives in the client bundle.
    setStatus({ type: 'submitting' });
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          website: honeypot,
          source: 'QuranNoor.com',
        }),
      });

      if (!response.ok) {
        let detail = `Submission returned status ${response.status}`;
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) detail = data.error;
        } catch {
          // Keep the status-based message when the body is not JSON.
        }
        throw new Error(detail);
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
          <ThemedSelect
            id="contact-subject"
            ariaLabel="Topic / Subject"
            value={subject}
            options={CONTACT_TOPIC_OPTIONS}
            onChange={setSubject}
            searchable={false}
            className="w-full"
          />
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
            <span>Protected by honeypot filtering, client validation &amp; server-side rate limiting.</span>
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
          Your message is sent to our server-side contact endpoint, where it is protected by
          honeypot filtering, client validation, and server-side rate limiting. Submitted details are
          governed by our <Link to="/privacy-policy" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Privacy Policy</Link>.
        </p>
      </section>
    </div>
  );
}
