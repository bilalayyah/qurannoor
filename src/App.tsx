import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AudioPlayer } from './components/AudioPlayer';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { InstallAppModal } from './components/InstallAppModal';
import { InstallPrompt } from './components/InstallPrompt';
import { ReaderSettings } from './components/ReaderSettings';
import { ScrollToTop } from './components/ScrollToTop';
import { AudioProvider, useAudio } from './context/AudioContext';
import { ReaderProvider, useReader } from './context/ReaderContext';

const HomePage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage }))
);
const QuranGatewayPage = lazy(() =>
  import('./pages/QuranGatewayPage').then((m) => ({ default: m.QuranGatewayPage }))
);
const SurahsPage = lazy(() =>
  import('./pages/SurahsPage').then((m) => ({ default: m.SurahsPage }))
);
const SurahReaderPage = lazy(() =>
  import('./pages/SurahReaderPage').then((m) => ({ default: m.SurahReaderPage }))
);
const AyahPage = lazy(() =>
  import('./pages/AyahPage').then((m) => ({ default: m.AyahPage }))
);
const JuzExplorerPage = lazy(() =>
  import('./pages/JuzExplorerPage').then((m) => ({ default: m.JuzExplorerPage }))
);
const JuzReaderPage = lazy(() =>
  import('./pages/JuzReaderPage').then((m) => ({ default: m.JuzReaderPage }))
);
const PopularPassagePage = lazy(() =>
  import('./pages/PopularPassagePage').then((m) => ({ default: m.PopularPassagePage }))
);
const ListenPage = lazy(() =>
  import('./pages/ListenPage').then((m) => ({ default: m.ListenPage }))
);
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage }))
);
const BookmarksPage = lazy(() =>
  import('./pages/BookmarksPage').then((m) => ({ default: m.BookmarksPage }))
);
const KhatmPage = lazy(() =>
  import('./pages/KhatmPage').then((m) => ({ default: m.KhatmPage }))
);
const PrayerTimesPage = lazy(() =>
  import('./pages/PrayerTimesPage').then((m) => ({ default: m.PrayerTimesPage }))
);
const AboutPage = lazy(() =>
  import('./pages/InfoPages').then((m) => ({ default: m.AboutPage }))
);
const MethodologyPage = lazy(() =>
  import('./pages/InfoPages').then((m) => ({ default: m.MethodologyPage }))
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPolicyPage }))
);
const TermsPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.TermsPage }))
);
const DisclaimerPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.DisclaimerPage }))
);
const CookiePolicyPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.CookiePolicyPage }))
);
const CopyrightPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.CopyrightPage }))
);
const AccessibilityPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.AccessibilityPage }))
);
const BrandPage = lazy(() =>
  import('./pages/BrandPage').then((m) => ({ default: m.BrandPage }))
);

function RouteFallback() {
  return (
    <div
      className="mx-auto max-w-[850px] px-4 py-16 text-center text-sm"
      style={{ color: 'var(--text-tertiary)' }}
    >
      Loading...
    </div>
  );
}

function AppShell() {
  const { toastMessage } = useReader();
  const { isPlaying, isLoading, activeVerseKey, activeChapterId } = useAudio();
  const hasActiveAudio = Boolean(activeVerseKey || activeChapterId || isPlaying || isLoading);

  return (
    <div className={`flex min-h-screen flex-col overflow-x-hidden ${hasActiveAudio ? 'pb-16' : ''}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        Skip to main content
      </a>

      <Header />

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/quran" element={<QuranGatewayPage />} />
            <Route path="/surahs" element={<SurahsPage />} />
            <Route path="/surah/:slug" element={<SurahReaderPage />} />
            <Route path="/surah/:slug/:ayahNumber" element={<SurahReaderPage />} />
            <Route path="/ayah/:slug/:ayahNumber" element={<AyahPage />} />
            <Route path="/juz" element={<JuzExplorerPage />} />
            <Route path="/juz/:juzNumber" element={<JuzReaderPage />} />
            <Route path="/popular/:slug" element={<PopularPassagePage />} />
            <Route path="/listen" element={<ListenPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/khatm" element={<KhatmPage />} />
            <Route path="/prayer-times" element={<PrayerTimesPage />} />
            <Route path="/qibla" element={<Navigate to="/prayer-times" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-and-conditions" element={<TermsPage />} />
            <Route path="/disclaimer" element={<DisclaimerPage />} />
            <Route path="/cookie-policy" element={<CookiePolicyPage />} />
            <Route path="/copyright" element={<CopyrightPage />} />
            <Route path="/accessibility" element={<AccessibilityPage />} />
            <Route path="/quran-text-and-translation-methodology" element={<MethodologyPage />} />
            <Route path="/brand" element={<BrandPage />} />
            {/* Legacy route redirects */}
            <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
            <Route path="/terms" element={<Navigate to="/terms-and-conditions" replace />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />
      <ReaderSettings />
      <AudioPlayer />
      <InstallPrompt />
      <InstallAppModal />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-xs font-medium text-white shadow-lg"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ReaderProvider>
        <AudioProvider>
          <AppShell />
        </AudioProvider>
      </ReaderProvider>
    </BrowserRouter>
  );
}
