import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, BookOpenCheck, Image as ImageIcon, Paperclip, Square, X,
  FileText, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { ensureBackend } from '../../lib/chatService';
import { deleteDocumentRemote } from '../../lib/documentService';

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

export default function Composer({ onSend, onStop, isStreaming, onAttach, mode }) {
  const useRag = useChatStore((s) => s.useRag);
  const setUseRag = useChatStore((s) => s.setUseRag);
  const documents = useChatStore((s) => s.documents);
  const removeDocument = useChatStore((s) => s.removeDocument);
  const hasReadyDocs = documents.some((d) => d.status === 'READY');
  const [value, setValue] = useState('');
  const [image, setImage] = useState(null); // downscaled data URL
  const taRef = useRef(null);
  const imageInputRef = useRef(null);

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

  const pickImage = async (file) => {
    if (!file) return;
    try {
      setImage(await readAndResize(file));
    } catch {
      /* ignore unreadable images */
    }
  };

  const removeDoc = (id) => {
    removeDocument(id);
    ensureBackend().then((live) => live && deleteDocumentRemote(id));
  };

  const submit = () => {
    const text = value.trim();
    if ((!text && !image) || isStreaming) return;
    onSend(text, image);
    setValue('');
    setImage(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-line bg-bg/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl xl:max-w-4xl 2xl:max-w-5xl min-[2200px]:max-w-[88rem] min-[3200px]:max-w-[120rem]">
        {/* Attachments preview: uploaded documents (RAG) + the pending image */}
        {(image || documents.length > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {documents.map((d) => {
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
                <span className="text-xs text-muted">Image</span>
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  title="Remove image"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </span>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/15">
          <button
            type="button"
            onClick={onAttach}
            title="Attach a document (RAG)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            title="Attach an image (the AI will look at it)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <ImageIcon size={18} />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) pickImage(e.target.files[0]);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => setUseRag(!useRag)}
            disabled={!hasReadyDocs}
            title={
              hasReadyDocs
                ? useRag
                  ? 'Answers grounded on your notes — click to disable'
                  : 'Ground answers on your uploaded notes'
                : 'Upload a document first to use your notes'
            }
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              useRag && hasReadyDocs
                ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                : 'text-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <BookOpenCheck size={16} />
            <span className="hidden sm:inline">My notes</span>
          </button>

          <textarea
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              image
                ? 'Ask about the image…'
                : narrow
                  ? 'Ask anything…'
                  : 'Ask anything…  (Enter to send, Shift+Enter for newline)'
            }
            className="scroll-thin max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[0.72rem] leading-relaxed text-fg placeholder:text-faint focus:outline-none sm:text-[0.85rem]"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg transition hover:bg-line"
            >
              <Square size={16} className="fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim() && !image}
              title="Send"
              className="brand-grad flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-center text-[11px] text-faint">
          Privoraa can make mistakes. Verify important info. · Mode: <span className="capitalize">{mode.replace('_', ' ')}</span>
        </p>
      </div>
    </div>
  );
}
