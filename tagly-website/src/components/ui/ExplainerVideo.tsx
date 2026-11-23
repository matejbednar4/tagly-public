"use client";

// The hero's explainer video, shown on BOTH locales (Matej's call
// 2026-08-14, replacing the earlier EN "Speak Czech?" reveal): the voiceover
// and burned-in subtitles are Czech, and that's accepted on /en — the
// footage itself shows the product. Muted looping autoplay; controls let
// the visitor unmute.

export function ExplainerVideo({ label }: { label: string }) {
  return (
    <video
      // React omits the `muted` attribute from server-rendered HTML (it only
      // sets the DOM property), so the prerendered page could be blocked from
      // autoplaying. Mute via the ref before calling play() to make autoplay
      // stick; the rejection fallback is the poster + controls.
      ref={(el) => {
        if (!el) return;
        el.muted = true;
        el.play().catch(() => {});
      }}
      className="card aspect-video w-full overflow-hidden"
      src="/videos/explainer.mp4"
      poster="/videos/explainer-poster.jpg"
      controls
      playsInline
      autoPlay
      loop
      muted
      aria-label={label}
    />
  );
}
