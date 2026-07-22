import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useClickOutside } from './useClickOutside';

const CLOSE_MS = 140;

export default function AssistantOverflowMenu({ items }) {
  const [phase, setPhase] = useState('closed');
  const itemRefs = useRef([]);
  const triggerRef = useRef(null);
  const open = phase !== 'closed';

  const close = useCallback(() => {
    if (!open || phase === 'closing') return;
    setPhase('closing');
    window.setTimeout(() => {
      setPhase('closed');
      triggerRef.current?.focus();
    }, CLOSE_MS);
  }, [open, phase]);

  const rootRef = useClickOutside(close, open);

  useEffect(() => {
    if (phase === 'open') itemRefs.current[0]?.focus();
  }, [phase]);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const enabled = itemRefs.current.filter(Boolean);
    const current = enabled.indexOf(document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    enabled[(current + step + enabled.length) % enabled.length]?.focus();
  };

  return (
    <div ref={rootRef} className="assistant-overflow relative inline-flex" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="More response actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setPhase(open ? 'closing' : 'open')}
        className="assistant-overflow-trigger rounded-md p-1.5 text-muted/70 transition hover:bg-surface-2 hover:text-fg"
      >
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="More response actions"
          className={`assistant-overflow-menu ${phase === 'closing' ? 'is-closing' : ''}`}
        >
          {items.map(({ id, label, icon: Icon, onSelect, disabled }) => (
            <button
              key={id}
              ref={(node) => { itemRefs.current[items.findIndex((item) => item.id === id)] = node; }}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onSelect();
                close();
              }}
              className="assistant-overflow-item"
            >
              {React.createElement(Icon, { size: 16, 'aria-hidden': true })}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
