import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, BookOpenCheck, Image as ImageIcon, Paperclip, Square, X,
  FileText, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { ensureBackend } from '../../lib/chatService';
import { deleteDocumentRemote } from '../../lib/documentService';
import { clipboardImages, shouldSubmitFromKey, validateImageFile } from './composerInput';
import { shouldDisableSourcesAfterRemoval } from './sourceState';

const DOC_STATUS = {
  PROCESSING: { Icon: Loader2, cls: 'text-amber-500 animate-spin' },
  READY: { Icon: CheckCircle2, cls: 'text-emerald-500' },
  FAILED: { Icon: XCircle, cls: 'text-red-500' },
};

/** Read an image file and downscale it to a data URL (keeps the vision payload small). */
function readAndResize(file, maxDim = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Composer({ onSend, onStop, isStreaming, onOpenSources, mode }) {
  const useRag = useChatStore((s) => s.useRag);
  const setUseRag = useChatStore((s) => s.setUseRag);
  const documents = useChatStore((s) => s.documents);
  const removeDocument = useChatStore((s) => s.removeDocument);
  const hasReadyDocs = documents.some((d) => d.status === 'READY');
  const [value, setValue] = useState('');
  const [image, setImage] = useState(null); // downscaled data URL
  const [imageName, setImageName] = useState('');
  const [attachmentStatus, setAttachmentStatus] = useState('');
  const taRef = useRef(null);
  const imageInputRef = useRef(null);
  const composerRef = useRef(null);

  // Keep the scrollable conversation clear of the floating composer at every
  // textarea/attachment height, including zoom and mobile keyboard changes.
  useEffect(() => {
    const composer = composerRef.current;
    const shell = composer?.parentElement;
    if (!composer || !shell || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.ceil(entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height);
      shell.style.setProperty('--composer-height', `${height}px`);
      window.dispatchEvent(new CustomEvent('privoraa:composer-resize'));
    });
    observer.observe(composer);
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--composer-height');
    };
  }, []);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [value]);

  // The full placeholder (with the keyboard hint) overflows on phones — use a
  // short one on narrow screens.
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const processImageAttachment = async (file, label = file?.name || 'Pasted image') => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) { setAttachmentStatus(invalid); return; }
    setAttachmentStatus(`Preparing ${label}…`);
    try {
      setImage(await readAndResize(file));
      setImageName(label);
      setAttachmentStatus(`${label} attached.`);
    } catch {
      setAttachmentStatus('This image could not be read.');
    }
  };

  const removeDoc = (id) => {
    if (shouldDisableSourcesAfterRemoval(documents, id)) setUseRag(false);
    removeDocument(id);
    ensureBackend().then((live) => live && deleteDocumentRemote(id));
  };

  const submittingRef = useRef(false);
  const submitMessage = () => {
    const text = value.trim();
    if ((!text && !image) || isStreaming || submittingRef.current) return;
    submittingRef.current = true;
    onSend(text, image);
    setValue('');
    setImage(null);
    setImageName('');
    setAttachmentStatus('Message sent.');
    window.setTimeout(() => { submittingRef.current = false; }, 250);
  };

  const onKeyDown = (e) => {
    if (shouldSubmitFromKey(e)) {
      e.preventDefault();
      submitMessage();
    }
  };

  const onPaste = (event) => {
    const files = clipboardImages(event.clipboardData);
    if (!files.length) return;
    const hasText = event.clipboardData?.getData('text/plain');
    if (!hasText) event.preventDefault();
    processImageAttachment(files[0], files[0].name || 'Pasted image');
    if (files.length > 1) setAttachmentStatus('The first pasted image was attached.');
  };

  const onImageDrop = (event) => {
    const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    processImageAttachment(file);
  };

  return (
    <div ref={composerRef} className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent px-2 pb-[max(.5rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-6">
      <div className="mx-auto w-full max-w-[860px]">
        <p className="sr-only" aria-live="polite">{attachmentStatus}</p>
        {/* Compact Sources and image previews. */}
        {(image || documents.length > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {hasReadyDocs && <button
              type="button"
              onClick={() => setUseRag(!useRag)}
              aria-pressed={useRag}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium sm:hidden ${useRag ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'bg-surface text-muted'}`}
            ><BookOpenCheck size={14} />Use sources ({documents.filter((d) => d.status === 'READY').length})</button>}
            {documents.slice(0, 2).map((d) => {
              const st = DOC_STATUS[d.status] || DOC_STATUS.PROCESSING;
              const StIcon = st.Icon;
              return (
                <span
                  key={d.id}
                  title={`${d.filename}${d.status === 'READY' ? ` · ${d.chunkCount} chunks` : ` · ${d.status?.toLowerCase?.() || ''}`}`}
                  className="inline-flex max-w-[220px] items-center gap-1.5 rounded-xl border border-line bg-surface py-1.5 pl-2.5 pr-1.5 text-xs"
                >
                  <FileText size={14} className="shrink-0 text-brand-400" />
                  <span className="truncate text-fg/90">{d.filename}</span>
                  <StIcon size={13} className={`shrink-0 ${st.cls}`} />
                  <button
                    type="button"
                    onClick={() => removeDoc(d.id)}
                    title="Remove"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                </span>
              );
            })}

            {image && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pr-2">
                <img src={image} alt="to send" className="h-10 w-10 rounded-lg object-cover" />
                <span className="max-w-32 truncate text-xs text-muted">{imageName || 'Image'}</span>
                <button
                  type="button"
                  onClick={() => { setImage(null); setImageName(''); setAttachmentStatus('Image removed.'); }}
                  title="Remove image"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </span>
            )}
          </div>
        )}

        <form
          onSubmit={(event) => { event.preventDefault(); submitMessage(); }}
          onDragOver={(event) => {
            const items = Array.from(event.dataTransfer?.items || []);
            if (items.some((item) => item.type.startsWith('image/')) || Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault();
          }}
          onDrop={onImageDrop}
          className="elevated-surface flex items-end gap-1 rounded-[22px] p-2 transition focus-within:border-[var(--accent-primary)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] sm:gap-2"
        >
          <button
            type="button"
            onClick={onOpenSources}
            title="Add or manage sources"
            aria-label="Add or manage sources"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            title="Attach an image (the AI will look at it)"
            aria-label="Attach an image"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <ImageIcon size={18} />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) processImageAttachment(e.target.files[0]);
              e.target.value = '';
            }}
          />

          {documents.length > 0 && <button
            type="button"
            onClick={() => setUseRag(!useRag)}
            disabled={!hasReadyDocs}
            aria-pressed={useRag && hasReadyDocs}
            title={
              hasReadyDocs
                ? useRag
                  ? 'Answers grounded on your notes — click to disable'
                  : 'Ground answers on your uploaded notes'
                : 'Upload a document first to use your notes'
            }
            className={`hidden h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 sm:flex ${
              useRag && hasReadyDocs
                ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                : 'text-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <BookOpenCheck size={16} />
            <span>Use sources ({documents.filter((d) => d.status === 'READY').length})</span>
          </button>}

          <textarea
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            enterKeyHint="send"
            placeholder={
              image
                ? 'Ask about the image…'
                : narrow
                  ? 'Ask anything…'
                  : 'Ask anything…  (Enter to send, Shift+Enter for newline)'
            }
            aria-label="Message"
            className="scroll-thin max-h-[200px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-base leading-6 text-fg placeholder:text-faint focus:outline-none"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg transition hover:bg-line"
            >
              <Square size={16} className="fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim() && !image}
              title="Send"
              className="brand-grad flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </form>
        <p className="mt-1.5 hidden px-1 text-center text-[11px] text-faint sm:block">
          Vedix can make mistakes. Verify important info. · Mode: <span className="capitalize">{mode.replace('_', ' ')}</span>
        </p>
      </div>
    </div>
  );
}
