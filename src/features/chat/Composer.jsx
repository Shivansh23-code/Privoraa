import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, BookOpenCheck, Image as ImageIcon, Paperclip, Square, X,
  FileText, Loader2, CheckCircle2, XCircle,
  RotateCcw,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { ensureBackend } from '../../lib/chatService';
import { deleteDocumentRemote } from '../../lib/documentService';
import { clipboardFiles, shouldSubmitFromKey } from './composerInput';
import { shouldDisableSourcesAfterRemoval } from './sourceState';
import { uploadDocument } from '../../lib/documentService';
import { MAX_ATTACHMENTS, attachmentKind, createLongPasteFile, validateAttachment } from './attachments';

const DOC_STATUS = {
  PROCESSING: { Icon: Loader2, cls: 'text-amber-500 animate-spin' },
  READY: { Icon: CheckCircle2, cls: 'text-emerald-500' },
  FAILED: { Icon: XCircle, cls: 'text-red-500' },
};
const LONG_PASTE_THRESHOLD = 12000;

export default function Composer({ onSend, onStop, isStreaming, onOpenSources, onEditLast, mode }) {
  const useRag = useChatStore((s) => s.useRag);
  const setUseRag = useChatStore((s) => s.setUseRag);
  const documents = useChatStore((s) => s.documents);
  const removeDocument = useChatStore((s) => s.removeDocument);
  const addDocument = useChatStore((s) => s.addDocument);
  const updateDocument = useChatStore((s) => s.updateDocument);
  const hasReadyDocs = documents.some((d) => d.status === 'READY');
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState([]);
  const images = attachments.filter((item) => item.kind === 'image');
  const [attachmentStatus, setAttachmentStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [longPaste, setLongPaste] = useState(null);
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

  useEffect(() => {
    setAttachments((current) => current.map((attachment) => {
      if (!attachment.uploadedSourceId) return attachment;
      const source = documents.find((document) => document.id === attachment.uploadedSourceId);
      if (!source) return attachment;
      if (source.status === 'READY') {
        if (!useRag) queueMicrotask(() => setUseRag(true));
        return { ...attachment, status: 'ready', progress: 100 };
      }
      if (source.status === 'FAILED') return { ...attachment, status: 'error', error: source.errorMessage || 'Processing failed' };
      return attachment;
    }));
  }, [documents, setUseRag, useRag]);

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

  const processAttachment = async (file, label = file?.name || 'Pasted file') => {
    if (!file) return;
    if (attachments.length >= MAX_ATTACHMENTS) { setAttachmentStatus(`You can attach up to ${MAX_ATTACHMENTS} files.`); return; }
    const invalid = validateAttachment(file);
    if (invalid) { setAttachmentStatus(invalid); return; }
    const kind = attachmentKind(file);
    const id = `${Date.now()}-${Math.random()}`;
    setAttachmentStatus(`Preparing ${label}…`);
    setAttachments((current) => [...current, { id, file, name: label, mimeType: file.type, size: file.size, kind, status: 'processing', progress: 0, error: null }]);
    try {
      if (kind === 'image') {
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, data, previewUrl: data, status: 'ready', progress: 100 } : item));
      } else {
        const tempId = addDocument({ filename: file.name, type: file.type, size: file.size, status: 'PROCESSING' });
        const doc = await uploadDocument(file);
        updateDocument(tempId, { id: doc.id, status: doc.status, chunkCount: doc.chunkCount, type: file.type, size: file.size });
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, status: doc.status === 'READY' ? 'ready' : 'processing', progress: doc.status === 'READY' ? 100 : 50, uploadedSourceId: doc.id } : item));
      }
      setAttachmentStatus(`${label} attached.`);
    } catch (error) {
      setAttachments((current) => current.map((item) => item.id === id ? { ...item, status: 'error', error: error.message || 'Upload failed' } : item));
      setAttachmentStatus(`${label} could not be attached.`);
    }
  };

  const removeDoc = (id) => {
    if (shouldDisableSourcesAfterRemoval(documents, id)) setUseRag(false);
    removeDocument(id);
    ensureBackend().then((live) => live && deleteDocumentRemote(id));
  };

  const submittingRef = useRef(false);
  const submitMessage = async () => {
    const text = value.trim();
    if ((!text && !attachments.length) || isStreaming || submittingRef.current || attachments.some((item) => item.status === 'processing')) return;
    submittingRef.current = true;
    const imagePayloads = images.filter((item) => item.status === 'ready').map((item) => item.data);
    const messageAttachments = attachments.map((item) => ({
      id: item.id, name: item.name, mimeType: item.mimeType, size: item.size,
      kind: item.kind, status: item.status, uploadedSourceId: item.uploadedSourceId,
    }));
    onSend(text, imagePayloads[0] || null, imagePayloads, messageAttachments);
    setValue('');
    setAttachments([]);
    setAttachmentStatus('Message sent.');
    window.setTimeout(() => { submittingRef.current = false; }, 250);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp' && !value && !images.length) {
      e.preventDefault();
      onEditLast?.();
      return;
    }
    if (e.key === 'Escape' && longPaste) { setLongPaste(null); return; }
    if (shouldSubmitFromKey(e)) {
      e.preventDefault();
      submitMessage();
    }
  };

  const onPaste = (event) => {
    const files = clipboardFiles(event.clipboardData);
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    if (pastedText.length > LONG_PASTE_THRESHOLD) {
      event.preventDefault();
      setLongPaste(pastedText);
    }
    if (!files.length) return;
    const hasText = pastedText;
    if (!hasText) event.preventDefault();
    files.forEach((file, index) => processAttachment(file, file.name || `Pasted image ${index + 1}`));
  };

  const onImageDrop = (event) => {
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    event.preventDefault();
    files.forEach((file) => processAttachment(file));
  };

  return (
    <div ref={composerRef} className="mobile-composer-shell absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent px-2 pb-[max(.5rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-6">
      <div className="mx-auto w-full max-w-[860px]">
        <p className="sr-only" aria-live="polite">{attachmentStatus}</p>
        {/* Compact Sources and image previews. */}
        {(attachments.length > 0 || documents.length > 0) && (
          <div className="mobile-attachment-strip scroll-thin mb-2 flex max-w-full items-center gap-2 overflow-x-auto pb-1">
            {hasReadyDocs && <button
              type="button"
              onClick={() => setUseRag(!useRag)}
              aria-pressed={useRag}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium sm:hidden ${useRag ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'bg-surface text-muted'}`}
            ><BookOpenCheck size={14} />Use sources ({documents.filter((d) => d.status === 'READY').length})</button>}
            {documents.filter((document) => !attachments.some((attachment) => attachment.uploadedSourceId === document.id)).slice(0, 2).map((d) => {
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

            {attachments.map((attachment) => (
              <span key={attachment.id} className="mobile-attachment-chip inline-flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pr-2">
                {attachment.kind === 'image' ? <button type="button" onClick={() => window.open(attachment.previewUrl, '_blank')} aria-label={`Preview ${attachment.name}`}><img src={attachment.previewUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /></button> : <FileText size={24} className="text-brand-400" />}
                <span className="max-w-32 truncate text-xs text-muted">{attachment.name}<small className={`block ${attachment.status === 'error' ? 'text-red-500' : 'text-faint'}`}>{Math.max(1, Math.round(attachment.size / 1024))} KB · {attachment.status}</small></span>
                {attachment.status === 'error' && <button type="button" aria-label={`Retry ${attachment.name}`} onClick={() => { setAttachments((current) => current.filter((item) => item.id !== attachment.id)); processAttachment(attachment.file, attachment.name); }} className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-2"><RotateCcw size={13} /></button>}
                <button
                  type="button"
                  onClick={() => { setAttachments((current) => current.filter((item) => item.id !== attachment.id)); if (attachment.uploadedSourceId) removeDoc(attachment.uploadedSourceId); setAttachmentStatus('Attachment removed.'); }}
                  title="Remove attachment"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        <form
          onSubmit={(event) => { event.preventDefault(); submitMessage(); }}
          onDragOver={(event) => {
            const items = Array.from(event.dataTransfer?.items || []);
            if (items.some((item) => item.type.startsWith('image/')) || Array.from(event.dataTransfer?.types || []).includes('Files')) { event.preventDefault(); setDragActive(true); }
          }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
          onDrop={(event) => { setDragActive(false); onImageDrop(event); }}
          className="mobile-composer elevated-surface relative flex items-end gap-1 rounded-[22px] p-2 transition focus-within:border-[var(--accent-primary)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] sm:gap-2"
        >
          {dragActive && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[22px] border-2 border-dashed border-brand-400 bg-bg/90 text-sm font-medium text-brand-500" role="status">Drop images to attach</div>}
          <button
            type="button"
            onClick={onOpenSources}
            title="Add or manage sources"
            aria-label="Add or manage sources"
            className="mobile-composer-control flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            title="Attach an image (the AI will look at it)"
            aria-label="Attach an image"
            className="mobile-composer-control flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <ImageIcon size={18} />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif,.txt,.md,.log,.java,.js,.jsx,.ts,.tsx,.json,.xml,.yaml,.yml,.sql,.py,.cpp,.c,.cs,.html,.css,.pdf,.docx,.csv"
            multiple
            className="hidden"
            onChange={(e) => {
              Array.from(e.target.files || []).forEach((file) => processAttachment(file));
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
              attachments.length
                ? 'Ask about the attachments…'
                : narrow
                  ? 'Ask anything…'
                  : 'Ask anything…  (Enter to send, Shift+Enter for newline)'
            }
            aria-label="Message"
            className="mobile-composer-input scroll-thin max-h-[200px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-base leading-6 text-fg placeholder:text-faint focus:outline-none"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="mobile-send-button flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg transition hover:bg-line"
            >
              <Square size={16} className="fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!value.trim() && !attachments.length) || attachments.some((item) => item.status === 'processing')}
              title="Send"
              className="mobile-send-button brand-grad flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </form>
        {longPaste && <div role="dialog" aria-modal="true" aria-label="Choose how to paste long text" className="absolute bottom-[calc(100%+.5rem)] left-1/2 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
          <p className="font-medium text-fg">This paste is {longPaste.length.toLocaleString()} characters</p>
          <p className="mt-1 text-sm text-muted">Paste as text, or label it as an attached text file.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setLongPaste(null)} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">Cancel</button>
            <button type="button" onClick={() => { setValue((current) => current + longPaste); setLongPaste(null); }} className="rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2">Paste as text</button>
            <button type="button" onClick={() => { processAttachment(createLongPasteFile(longPaste)); setLongPaste(null); }} className="brand-grad rounded-lg px-3 py-2 text-sm text-white">Attach as TXT</button>
          </div>
        </div>}
        <p className="mt-1.5 hidden px-1 text-center text-[11px] text-faint sm:block">
          Vedix can make mistakes. Verify important info. · Mode: <span className="capitalize">{mode.replace('_', ' ')}</span>
        </p>
      </div>
    </div>
  );
}
