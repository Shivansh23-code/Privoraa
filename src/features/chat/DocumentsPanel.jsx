import React, { useRef, useState } from 'react';
import { Upload, FileText, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { ensureBackend } from '../../lib/chatService';
import { uploadDocument, deleteDocumentRemote } from '../../lib/documentService';

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
  const localRef = useRef(null);
  const inputRef = fileInputRef || localRef;
  const [dragging, setDragging] = useState(false);

  // Note: hydrating the document list AND polling PROCESSING docs to READY both
  // happen once in ChatWorkspace (a single, stable mount). This panel is mounted
  // in two places and remounts on toggle, so doing it here would multiply calls.

  const onFiles = async (files) => {
    // Snapshot the FileList NOW: the input's onChange clears e.target.value
    // synchronously right after this call, which empties the live FileList before
    // the async work below runs — iterating it later would find zero files.
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    const live = await ensureBackend();
    for (const file of fileList) {
      const tempId = addDocument({ filename: file.name, status: 'PROCESSING' });
      if (!live) {
        // No backend — local demo: simulate the chunk+embed pipeline.
        const chunks = Math.max(3, Math.round(file.size / 4000) || 8);
        setTimeout(() => updateDocument(tempId, { status: 'READY', chunkCount: chunks }), 1800);
        continue;
      }
      try {
        // Backend processes asynchronously; ChatWorkspace polls PROCESSING → READY.
        const doc = await uploadDocument(file);
        updateDocument(tempId, { id: doc.id, status: doc.status, chunkCount: doc.chunkCount });
      } catch (err) {
        updateDocument(tempId, { status: 'FAILED', errorMessage: err.message });
      }
    }
  };

  const onDelete = (id) => {
    removeDocument(id);
    ensureBackend().then((live) => live && deleteDocumentRemote(id));
  };

  return (
    <div className="flex flex-col gap-2">
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
            Your notes (RAG)
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
        <span>{dragging ? 'Drop to upload' : 'Upload or drop PDF / notes'}</span>
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
          Upload a file to chat grounded on it. Answers will cite the source chunks.
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
                </div>
                <button
                  onClick={() => onDelete(d.id)}
                  className="hidden h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-line hover:text-red-500 group-hover:flex"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
