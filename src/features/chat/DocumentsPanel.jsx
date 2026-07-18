import React, { useRef, useState } from 'react';
import { Upload, FileText, Trash2, Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { ensureBackend } from '../../lib/chatService';
import { uploadDocument, deleteDocumentRemote } from '../../lib/documentService';
import { shouldDisableSourcesAfterRemoval } from './sourceState';

const STATUS = {
  PROCESSING: { icon: Loader2, cls: 'text-amber-500 animate-spin', label: 'Processing' },
  READY: { icon: CheckCircle2, cls: 'text-emerald-500', label: 'Ready' },
  FAILED: { icon: XCircle, cls: 'text-red-500', label: 'Failed' },
};

export default function DocumentsPanel({ fileInputRef, hideHeading = false }) {
  const documents = useChatStore((s) => s.documents);
  const addDocument = useChatStore((s) => s.addDocument);
  const updateDocument = useChatStore((s) => s.updateDocument);
  const removeDocument = useChatStore((s) => s.removeDocument);
  const setUseRag = useChatStore((s) => s.setUseRag);
  const localRef = useRef(null);
  const inputRef = fileInputRef || localRef;
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const sourceFiles = useRef(new Map());

  // Note: hydrating the document list AND polling PROCESSING docs to READY both
  // happen once in ChatWorkspace (a single, stable mount). This panel is mounted
  // in two places and remounts on toggle, so doing it here would multiply calls.

  const uploadOne = async (file, existingId = null) => {
    const duplicate = documents.some((d) => d.filename === file.name && d.size === file.size && d.id !== existingId);
    if (duplicate) { setAnnouncement(`${file.name} is already in Sources.`); return; }
    const live = await ensureBackend();
    const tempId = existingId || addDocument({ filename: file.name, type: file.type, size: file.size, status: 'PROCESSING' });
    if (existingId) updateDocument(existingId, { status: 'PROCESSING', errorMessage: undefined });
    sourceFiles.current.set(tempId, file);
    setAnnouncement(`${file.name} is processing.`);
    if (!live) {
      const chunks = Math.max(3, Math.round(file.size / 4000) || 8);
      setTimeout(() => { updateDocument(tempId, { status: 'READY', chunkCount: chunks }); setAnnouncement(`${file.name} is ready.`); }, 1800);
      return;
    }
    try {
      const doc = await uploadDocument(file);
      updateDocument(tempId, { id: doc.id, status: doc.status, chunkCount: doc.chunkCount, type: file.type, size: file.size });
      sourceFiles.current.delete(tempId);
      sourceFiles.current.set(doc.id, file);
    } catch (err) {
      updateDocument(tempId, { status: 'FAILED', errorMessage: err.message });
      setAnnouncement(`${file.name} failed: ${err.message}`);
    }
  };

  const onFiles = async (files) => {
    // Snapshot the FileList NOW: the input's onChange clears e.target.value
    // synchronously right after this call, which empties the live FileList before
    // the async work below runs — iterating it later would find zero files.
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    for (const file of fileList) {
      await uploadOne(file);
    }
  };

  const onDelete = (id) => {
    const removed = documents.find((d) => d.id === id);
    removeDocument(id);
    sourceFiles.current.delete(id);
    if (removed?.status === 'READY' && shouldDisableSourcesAfterRemoval(documents, id)) setUseRag(false);
    setAnnouncement(`${removed?.filename || 'Source'} removed.`);
    ensureBackend().then((live) => live && deleteDocumentRemote(id));
  };

  return (
    <div className="flex flex-col gap-2">
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
            Sources
          </h3>
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-4 text-sm transition ${
          dragging
            ? 'border-brand-500 bg-brand-500/10 text-brand-500'
            : 'border-line bg-surface text-muted hover:border-brand-400 hover:text-fg'
        }`}
      >
        <Upload size={16} />
        <span>{dragging ? 'Drop to add sources' : 'Add or drop documents'}</span>
        <span className="text-xs text-faint">PDF, text, Office, CSV, and more</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.markdown,.doc,.docx,.rtf,.odt,.csv,.tsv,.html,.htm,.json,.xml,.pptx,.ppt,.xlsx,.xls,.epub"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {documents.length === 0 ? (
        <p className="px-1 py-2 text-xs text-faint">
          Add a document, wait until it is ready, then enable “Use sources” in the composer.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {documents.map((d) => {
            const st = STATUS[d.status] || STATUS.PROCESSING;
            const Icon = st.icon;
            return (
              <div
                key={d.id}
                className="group flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2"
              >
                <FileText size={15} className="shrink-0 text-brand-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{d.filename}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted">
                    <Icon size={11} className={st.cls} />
                    {st.label}
                    {d.status === 'READY' && ` · ${d.chunkCount} chunks`}
                  </p>
                  {d.size && <p className="text-[11px] text-faint">{Math.max(1, Math.round(d.size / 1024))} KB</p>}
                  {d.errorMessage && <p className="mt-1 text-xs text-red-500">{d.errorMessage}</p>}
                </div>
                {d.status === 'FAILED' && sourceFiles.current.get(d.id) && <button onClick={() => uploadOne(sourceFiles.current.get(d.id), d.id)} aria-label={`Retry ${d.filename}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"><RotateCcw size={14} /></button>}
                <button
                  onClick={() => onDelete(d.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-line hover:text-red-500"
                  title="Remove source"
                  aria-label={`Remove ${d.filename}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}
