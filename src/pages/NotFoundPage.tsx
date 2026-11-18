import { Link } from 'react-router-dom';
import { usePageMetadata } from '../hooks/usePageMetadata';

export function NotFoundPage() {
  usePageMetadata({
    title: 'Page Not Found – QuranNoor',
    description: 'The page you are looking for does not exist on QuranNoor.com.',
    noindex: true,
  });

  return (
    <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
      <p className="font-ui text-sm font-semibold" style={{ color: 'var(--gold)' }}>
        404
      </p>
      <h1
        className="mt-2 font-ui text-2xl font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        Page not found
      </h1>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        The page you are looking for does not exist or was moved. You can return to the
        homepage or browse all Surahs.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          to="/"
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Go to homepage
        </Link>
        <Link
          to="/surahs"
          className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
          style={{ color: 'var(--accent-text)', borderColor: 'var(--border-strong)' }}
        >
          Browse Surahs
        </Link>
      </div>
    </div>
  );
}
