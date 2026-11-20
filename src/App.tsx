import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AudioPlayer } from './components/AudioPlayer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { InstallAppModal } from './components/InstallAppModal';
import { InstallPrompt } from './components/InstallPrompt';
import { ReaderSettings } from './components/ReaderSettings';
import { ScrollToTop } from './components/ScrollToTop';
import { AudioProvider, useAudio } from './context/AudioContext';
import { ReaderProvider, useReader } from './context/ReaderContext';
import { createPreloadableRoute } from './utils/lazyRoute';

// H-1 (iteration 2): every route is lazy-loaded behind one <Suspense>
// below. The chunk for the CURRENT route is preloaded before
// hydrateRoot runs (see preloadRouteForPath + src/main.tsx) so the
// first render is the resolved component, not the "Loading..." fallback
// — otherwise hydration mismatches the prerendered page (React 418)
// and the whole page is discarded and client-rendered.
const { Component: HomePage, load: preloadHomePage } = createPreloadableRoute(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage })),
);
const { Component: QuranGatewayPage, load: preloadQuranGatewayPage } =
  createPreloadableRoute(() =>
    import('./pages/QuranGatewayPage').then((m) => ({ default: m.QuranGatewayPage })),
  );
const { Component: SurahsPage, load: preloadSurahsPage } = createPreloadableRoute(() =>
  import('./pages/SurahsPage').then((m) => ({ default: m.SurahsPage })),
);
const { Component: SurahReaderPage, load: preloadSurahReaderPage } = createPreloadableRoute(
  () => import('./pages/SurahReaderPage').then((m) => ({ default: m.SurahReaderPage })),
);
const { Component: AyahPage, load: preloadAyahPage } = createPreloadableRoute(() =>
  import('./pages/AyahPage').then((m) => ({ default: m.AyahPage })),
);
const { Component: JuzExplorerPage, load: preloadJuzExplorerPage } = createPreloadableRoute(
  () => import('./pages/JuzExplorerPage').then((m) => ({ default: m.JuzExplorerPage })),
);
const { Component: JuzReaderPage, load: preloadJuzReaderPage } = createPreloadableRoute(() =>
  import('./pages/JuzReaderPage').then((m) => ({ default: m.JuzReaderPage })),
);
const { Component: PopularPassagePage, load: preloadPopularPassagePage } =
  createPreloadableRoute(() =>
    import('./pages/PopularPassagePage').then((m) => ({ default: m.PopularPassagePage })),
  );
const { Component: ListenPage, load: preloadListenPage } = createPreloadableRoute(() =>
  import('./pages/ListenPage').then((m) => ({ default: m.ListenPage })),
);
const { Component: SearchPage, load: preloadSearchPage } = createPreloadableRoute(() =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })),
);
const { Component: BookmarksPage, load: preloadBookmarksPage } = createPreloadableRoute(() =>
  import('./pages/BookmarksPage').then((m) => ({ default: m.BookmarksPage })),
);
const { Component: PrayerTimesPage, load: preloadPrayerTimesPage } = createPreloadableRoute(
  () => import('./pages/PrayerTimesPage').then((m) => ({ default: m.PrayerTimesPage })),
);
const { Component: GuidesIndexPage, load: preloadGuidesIndexPage } = createPreloadableRoute(
  () => import('./pages/GuidesPage').then((m) => ({ default: m.GuidesIndexPage })),
);
const { Component: GuideArticlePage, load: preloadGuideArticlePage } = createPreloadableRoute(
  () => import('./pages/GuidesPage').then((m) => ({ default: m.GuideArticlePage })),
);
const { Component: AboutPage, load: preloadAboutPage } = createPreloadableRoute(() =>
  import('./pages/InfoPages').then((m) => ({ default: m.AboutPage })),
);
const { Component: MethodologyPage, load: preloadMethodologyPage } = createPreloadableRoute(
  () => import('./pages/InfoPages').then((m) => ({ default: m.MethodologyPage })),
);
const { Component: ContactPage, load: preloadContactPage } = createPreloadableRoute(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })),
);
const { Component: PrivacyPolicyPage, load: preloadPrivacyPolicyPage } =
  createPreloadableRoute(() =>
    import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPolicyPage })),
  );
const { Component: TermsPage, load: preloadTermsPage } = createPreloadableRoute(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })),
);
const { Component: DisclaimerPage, load: preloadDisclaimerPage } = createPreloadableRoute(
  () => import('./pages/LegalPages').then((m) => ({ default: m.DisclaimerPage })),
);
const { Component: CookiePolicyPage, load: preloadCookiePolicyPage } =
  createPreloadableRoute(() =>
    import('./pages/LegalPages').then((m) => ({ default: m.CookiePolicyPage })),
  );
const { Component: CopyrightPage, load: preloadCopyrightPage } = createPreloadableRoute(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.CopyrightPage })),
);
const { Component: AccessibilityPage, load: preloadAccessibilityPage } =
  createPreloadableRoute(() =>
    import('./pages/LegalPages').then((m) => ({ default: m.AccessibilityPage })),
  );
const { Component: BrandPage, load: preloadBrandPage } = createPreloadableRoute(() =>
  import('./pages/BrandPage').then((m) => ({ default: m.BrandPage })),
);
const { Component: NotFoundPage } = createPreloadableRoute(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

/**
 * H-1 (iteration 2): preload the chunk for the route matching the
 * current pathname, so the first client render (hydration) can render
 * the route synchronously instead of suspending on the Suspense
 * fallback. Call this BEFORE hydrateRoot (see src/main.tsx). Only the
 * current route's chunk is preloaded; other routes keep lazy-loading
 * on navigation. Unknown paths resolve immediately — the 404 shell and
 * the redirect routes have no prerendered route component to load.
 */
export function preloadRouteForPath(pathname: string): Promise<void> {
  const path = pathname.replace(/\/+$/, '') || '/';
  const load =
    path === '/'
      ? preloadHomePage
      : path === '/quran'
        ? preloadQuranGatewayPage
        : path === '/surahs'
          ? preloadSurahsPage
          : /^\/surah\/[^/]+(?:\/[^/]+)?$/.test(path)
            ? preloadSurahReaderPage
            : /^\/ayah\/[^/]+\/[^/]+$/.test(path)
              ? preloadAyahPage
              : path === '/juz'
                ? preloadJuzExplorerPage
                : /^\/juz\/[^/]+$/.test(path)
                  ? preloadJuzReaderPage
                  : /^\/popular\/[^/]+$/.test(path)
                    ? preloadPopularPassagePage
                    : path === '/listen'
                      ? preloadListenPage
                      : path === '/search'
                        ? preloadSearchPage
                        : path === '/bookmarks'
                          ? preloadBookmarksPage
                          : path === '/prayer-times'
                            ? preloadPrayerTimesPage
                            : path === '/guides'
                              ? preloadGuidesIndexPage
                              : /^\/guides\/[^/]+$/.test(path)
                                ? preloadGuideArticlePage
                                : path === '/about'
                                  ? preloadAboutPage
                                  : path === '/contact'
                                    ? preloadContactPage
                                    : path === '/privacy-policy'
                                      ? preloadPrivacyPolicyPage
                                      : path === '/terms-and-conditions'
                                        ? preloadTermsPage
                                        : path === '/disclaimer'
                                          ? preloadDisclaimerPage
                                          : path === '/cookie-policy'
                                            ? preloadCookiePolicyPage
                                            : path === '/copyright'
                                              ? preloadCopyrightPage
                                              : path === '/accessibility'
                                                ? preloadAccessibilityPage
                                                : path ===
                                                    '/quran-text-and-translation-methodology'
                                                  ? preloadMethodologyPage
                                                  : path === '/brand'
                                                    ? preloadBrandPage
                                                    : undefined;
  return load ? load().then(() => undefined) : Promise.resolve();
}

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
    <div className={`flex min-h-screen flex-col overflow-x-clip ${hasActiveAudio ? 'pb-16' : ''}`}>
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
            <Route path="/prayer-times" element={<PrayerTimesPage />} />
            <Route path="/qibla" element={<Navigate to="/prayer-times" replace />} />
            <Route path="/guides" element={<GuidesIndexPage />} />
            <Route path="/guides/:slug" element={<GuideArticlePage />} />
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
            <Route path="*" element={<NotFoundPage />} />
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

/**
 * Wraps the whole app shell — header, footer, audio player, reader settings,
 * install prompt and routes — in the ErrorBoundary, so a render crash in a
 * persistent chrome component shows the friendly fallback instead of blanking
 * the app. The boundary still resets when the pathname changes, exactly as it
 * did when it wrapped only <Routes>. This must live inside <BrowserRouter>
 * so useLocation() works.
 */
function AppShellWithErrorBoundary() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <AppShell />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ReaderProvider>
        <AudioProvider>
          <AppShellWithErrorBoundary />
        </AudioProvider>
      </ReaderProvider>
    </BrowserRouter>
  );
}
