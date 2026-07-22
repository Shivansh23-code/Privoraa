import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileFinalContent } from '../src/features/chat/finalContent.js';
import { attachmentKind, createLongPasteFile, validateAttachment, MAX_ATTACHMENTS } from '../src/features/chat/attachments.js';

test('completion reconciliation preserves huge streamed code responses', () => {
  const streamed = Array.from({ length: 100 }, (_, index) => `\n\`\`\`js\nconst value${index} = ${index};\n\`\`\``).join('');
  assert.equal(reconcileFinalContent(streamed, 'Short summary.'), streamed);
});

test('supported mixed attachments are classified independently', () => {
  const files = [
    new File(['image'], 'one.png', { type: 'image/png' }),
    new File(['class A {}'], 'A.java', { type: 'text/x-java-source' }),
    new File(['a,b'], 'rows.csv', { type: 'text/csv' }),
  ];
  assert.deepEqual(files.map(attachmentKind), ['image', 'source', 'source']);
  assert.deepEqual(files.map(validateAttachment), [null, null, null]);
  assert.equal(MAX_ATTACHMENTS, 12);
});

test('unsupported archives are rejected instead of pretending to upload', () => {
  const archive = new File(['zip'], 'unsafe.zip', { type: 'application/zip' });
  assert.equal(attachmentKind(archive), 'unsupported');
  assert.equal(validateAttachment(archive), 'Unsupported file type.');
});

test('long paste creates a real removable/uploadable text file', async () => {
  const text = 'large prompt\n'.repeat(2000);
  const file = createLongPasteFile(text);
  assert.equal(file.name, 'pasted-text.txt');
  assert.equal(file.type, 'text/plain');
  assert.equal(await file.text(), text);
  assert.equal(attachmentKind(file), 'source');
  assert.equal(validateAttachment(file), null);
});
