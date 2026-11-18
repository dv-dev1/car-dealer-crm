"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: { sitekey: string }): string;
      remove(widgetId: string): void;
    };
  }
}

// A Turnstile token is single use, so a fresh widget is rendered for every new form state.
export function Turnstile({ siteKey, renewOn }: { siteKey: string; renewOn: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded || !container.current || !window.turnstile) return;
    const widgetId = window.turnstile.render(container.current, { sitekey: siteKey });
    return () => window.turnstile?.remove(widgetId);
  }, [loaded, siteKey, renewOn]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setLoaded(true)}
      />
      <div ref={container} />
    </>
  );
}
