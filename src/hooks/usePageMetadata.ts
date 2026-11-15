import { useEffect } from 'react';

interface PageMetadataOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function usePageMetadata({
  title,
  description,
  canonicalPath,
  noindex = false,
  ogType = 'website',
  jsonLd,
}: PageMetadataOptions) {
  useEffect(() => {
    document.title = title;

    const updateMeta = (
      selector: string,
      attr: 'name' | 'property',
      key: string,
      content: string
    ) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    updateMeta('meta[name="description"]', 'name', 'description', description);
    updateMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      noindex ? 'noindex, follow' : 'index, follow'
    );
    updateMeta('meta[property="og:type"]', 'property', 'og:type', ogType);
    updateMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'QuranNoor');
    updateMeta('meta[property="og:title"]', 'property', 'og:title', title);
    updateMeta('meta[property="og:description"]', 'property', 'og:description', description);
    updateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    updateMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    const origin = window.location.origin;
    const path = canonicalPath ?? window.location.pathname;
    const canonicalUrl = `${origin}${path}`;

    updateMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    updateMeta('meta[property="og:image"]', 'property', 'og:image', `${origin}/icon-app.svg`);

    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    const scriptId = 'qurannoor-page-jsonld';
    const existingScript = document.getElementById(scriptId);
    if (jsonLd) {
      let scriptEl = existingScript as HTMLScriptElement | null;
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = scriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    } else if (existingScript) {
      existingScript.remove();
    }

    return () => {
      const cleanupEl = document.getElementById(scriptId);
      if (cleanupEl) cleanupEl.remove();
    };
  }, [title, description, canonicalPath, noindex, ogType, jsonLd]);
}
