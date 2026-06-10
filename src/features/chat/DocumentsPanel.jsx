import React, { useRef } from 'react';
import { Upload, FileText, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

const STATUS = {
  PROCESSING: { icon: Loader2, cls: 'text-amber-500 animate-spin', label: 'Processing' },
  READY: { icon: CheckCircle2, cls: 'text-emerald-500', label: 'Ready' },
  FAILED: { icon: XCircle, cls: 'text-red-500', label: 'Failed' },
};

export default function DocumentsPanel({ fileInputRef }) {
  const documents = useChatStore((s) => s.documents);
  const addDocument = useChatStore((s) => s.addDocument);
  const updateDocument = useChatStore((s) => s.updateDocument);
  const removeDocument = useChatStore((s) => s.removeDocument);
  const localRef = useRef(null);
  const inputRef = fileInputRef || localRef;

  const onFiles = (files) => {
    Array.from(files).forEach((file) => {
      const id = addDocument({ filename: file.name, status: 'PROCESSING' });
      // Simulate the async chunk+embed pipeline until the backend exists.
      const chunks = Math.max(3, Math.round(file.size / 4000) || 8);
      setTimeout(() => updateDocument(id, { status: 'READY', chunkCount: chunks }), 1800);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
          Your notes (RAG)
        </h3>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface py-2.5 text-sm text-muted transition hover:border-brand-400 hover:text-fg"
      >
        <Upload size={15} /> Upload PDF / notes
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.docx"
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
                  onClick={() => removeDocument(d.id)}
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
