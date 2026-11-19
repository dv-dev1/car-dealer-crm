"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: { sitekey: string; size: "normal" | "compact" }): string;
      remove(widgetId: string): void;
    };
  }
}

// The normal widget is 300 px wide; in a narrower card (a 360 px phone) the 150 px compact one fits.
export function turnstileSize(width: number): "normal" | "compact" {
  return width < 300 ? "compact" : "normal";
}

// A Turnstile token is single use, so a fresh widget is rendered for every new form state.
export function Turnstile({ siteKey, renewOn }: { siteKey: string; renewOn: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // No key (a secret that was not set): no widget, and the form is refused by the server instead of the page breaking.
    if (!loaded || !siteKey || !container.current || !window.turnstile) return;
    const widgetId = window.turnstile.render(container.current, {
      sitekey: siteKey,
      size: turnstileSize(container.current.offsetWidth),
    });
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
