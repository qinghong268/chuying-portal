import { useEffect, useRef, useState } from "react";

/**
 * Fades an element in (opacity 0→1, translateY 30px→0) as it scrolls into view.
 * Attach the returned `ref` to the element; when `visible` flips to true the
 * element is intersecting and should get the "visible" style applied.
 */
export function useFadeIn<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback for environments without IntersectionObserver: show immediately.
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1, ...options },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}
