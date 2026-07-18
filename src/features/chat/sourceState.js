export function readySourceCount(documents) {
  return documents.filter((document) => document.status === 'READY').length;
}

export function shouldDisableSourcesAfterRemoval(documents, removedId) {
  return readySourceCount(documents.filter((document) => document.id !== removedId)) === 0;
}
