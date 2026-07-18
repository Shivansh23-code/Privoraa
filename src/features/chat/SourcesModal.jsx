import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import DocumentsPanel from './DocumentsPanel';

export default function SourcesModal({ open, onClose }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const returnFocus = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = [...(panelRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); returnFocus?.focus?.(); };
  }, [open, onClose]);
  return (
    <div aria-hidden={!open} className={`${open ? 'flex' : 'hidden'} fixed inset-0 z-50 items-end justify-center sm:items-center sm:p-4`}>
      <button className="absolute inset-0 bg-[var(--overlay)]" aria-label="Close sources" onClick={onClose} />
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="sources-title" className="elevated-surface floating-surface relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="sources-title" className="font-display text-xl font-semibold">Sources</h2>
            <p className="mt-1 text-sm text-muted">Add documents to ground answers in your material.</p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close sources" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"><X size={18} /></button>
        </div>
        <DocumentsPanel />
      </section>
    </div>
  );
}
