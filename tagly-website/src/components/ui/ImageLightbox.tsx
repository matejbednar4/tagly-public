"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

// NOT `{ ssr: false }`. The <Image> below is Zoom's CHILD, so disabling Zoom's
// server render dropped every lightboxed image out of the prerendered HTML —
// the whole homepage gallery, the how-it-works screenshots and every industry
// page's examples existed only after hydration, alt text included. Zoom only
// adds click-to-enlarge, so it renders server-side happily; keep it that way.
const Zoom = dynamic(() => import("react-medium-image-zoom"));
import "react-medium-image-zoom/dist/styles.css";

interface ImageLightboxProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  /** Override when the image renders much narrower than half the viewport. */
  sizes?: string;
}

export function ImageLightbox({
  src,
  alt,
  fill,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: ImageLightboxProps) {
  return (
    <>
      <style>{`
        .lightbox-overlay [data-rmiz-modal-overlay="visible"] {
          background-color: rgba(56, 39, 36, 0.85);
        }
        .lightbox-overlay [data-rmiz-modal-overlay="hidden"] {
          background-color: rgba(56, 39, 36, 0);
        }
      `}</style>
      <Zoom zoomImg={{ src, alt }} classDialog="lightbox-overlay">
        <Image
          src={src}
          alt={alt}
          fill={fill}
          className={className}
          sizes={sizes}
        />
      </Zoom>
    </>
  );
}
