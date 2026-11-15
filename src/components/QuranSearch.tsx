import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReader } from '../context/ReaderContext';
import { toSurahSlug } from '../utils/slugs';

interface QuranSearchProps {
  initialValue?: string;
  placeholder?: string;
  onSubmitQuery?: (query: string) => void;
  className?: string;
}

export function QuranSearch({
  initialValue = '',
  placeholder = 'Search Surah, Ayah (e.g. 2:255), or keyword...',
  onSubmitQuery,
  className = '',
}: QuranSearchProps) {
  const navigate = useNavigate();
  const { chapters } = useReader();
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (onSubmitQuery) {
      onSubmitQuery(trimmed);
      return;
    }

    const refMatch = trimmed.match(/^(\d{1,3}):(\d{1,3})$/);
    if (refMatch) {
      const chId = Number(refMatch[1]);
      const ayahNum = Number(refMatch[2]);
      const ch = chapters.find((c) => c.id === chId);
      if (ch) {
        navigate(`/surah/${toSurahSlug(ch.name_simple)}?ayah=${ayahNum}`);
        return;
      }
    }

    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search the Quran"
      className={className}
    >
      <div
        className="flex items-center gap-2 rounded-2xl border p-1.5 transition-colors focus-within:border-[#0E6B4B] dark:focus-within:border-[#3FD09A]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <Search
          className="ml-3 h-5 w-5 shrink-0"
          style={{ color: 'var(--text-tertiary)' }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search Quran"
          className="w-full min-h-[44px] bg-transparent px-2 text-sm sm:text-base outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          type="submit"
          className="min-h-[40px] shrink-0 rounded-xl px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Search
        </button>
      </div>
    </form>
  );
}
