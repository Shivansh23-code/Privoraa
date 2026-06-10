import { useEffect, useRef } from 'react';

/** Calls `handler` when a pointerdown/Escape happens outside the returned ref. */
export function useClickOutside(handler, active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') handler();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [handler, active]);
  return ref;
}
