"use client";

import { useEffect } from "react";

export function ScrollAnimator() {
  useEffect(() => {
    function observeSections() {
      const sections = document.querySelectorAll(
        "section:not(.fade-in-section)",
      );
      sections.forEach((section) => {
        if (section.closest("[data-no-animate]")) return;
        section.classList.add("fade-in-section");
      });

      const targets = document.querySelectorAll(
        ".fade-in-section:not(.is-visible)",
      );
      if (targets.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: window.innerWidth < 1024 ? 0.01 : 0.1 },
      );

      targets.forEach((target) => observer.observe(target));

      return observer;
    }

    // Signal that JS is ready — fade-in styles only apply under .js-ready
    document.documentElement.classList.add("js-ready");

    const observer = observeSections();

    // Watch for dynamically added sections (e.g. route changes)
    const mutationObserver = new MutationObserver(() => {
      observeSections();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
