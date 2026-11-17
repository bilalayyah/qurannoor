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
  compact?: boolean;
}

export function QuranSearch({
  initialValue = '',
  placeholder = 'Search Surah, Ayah (e.g. 2:255), or keyword...',
  onSubmitQuery,
  className = '',
  compact = false,
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
        className={`flex items-center gap-2 border transition-colors focus-within:border-[#0E6B4B] dark:focus-within:border-[#3FD09A] ${
          compact ? 'rounded-xl p-1' : 'rounded-2xl p-1.5'
        }`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <Search
          className={`shrink-0 ${compact ? 'ml-2.5 h-4 w-4' : 'ml-3 h-5 w-5'}`}
          style={{ color: 'var(--text-tertiary)' }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search Quran"
          className={`w-full bg-transparent px-2 outline-none ${
            compact
              ? 'min-h-[34px] sm:min-h-[36px] text-xs sm:text-sm'
              : 'min-h-[44px] text-sm sm:text-base'
          }`}
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          type="submit"
          className={`shrink-0 font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap ${
            compact
              ? 'min-h-[32px] sm:min-h-[34px] rounded-lg px-3.5 py-1 text-xs sm:text-sm'
              : 'min-h-[40px] rounded-xl px-5 py-2 text-sm'
          }`}
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Search
        </button>
      </div>
    </form>
  );
}
