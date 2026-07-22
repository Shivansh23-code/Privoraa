export function reconcileFinalContent(streamedContent = '', finalContent) {
  if (finalContent == null) return streamedContent;
  if (!streamedContent) return finalContent;
  // The token stream is the lossless response. A terminal payload may repeat it,
  // extend it (for providers that buffer a final part), or be a stale/trimmed
  // snapshot. Never replace a longer accumulated answer with a shorter one.
  if (finalContent === streamedContent || finalContent.startsWith(streamedContent)) {
    return finalContent;
  }
  return streamedContent;
}

export function finalContentPatch(usage = {}, streamedContent = '') {
  return {
    ...(usage.finalContent != null
      ? { content: reconcileFinalContent(streamedContent, usage.finalContent) }
      : {}),
    tailTrimmed: usage.tailTrimmed === true,
    repairAttempted: usage.repairAttempted === true,
    completionRepaired: usage.completionRepaired === true,
    repairSegments: Number.isInteger(usage.repairSegments) ? usage.repairSegments : 0,
    rawFinishReason: usage.rawFinishReason,
    completionStatus: usage.completionStatus,
    finalizationReason: usage.finalizationReason,
  };
}
