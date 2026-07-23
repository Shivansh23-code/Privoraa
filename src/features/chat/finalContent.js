export function safeMerge(base, next, overlapWindow = 80) {
  if (!base) return next || '';
  if (!next) return base;
  const window = Math.max(0, overlapWindow);
  const max = Math.min(base.length, next.length, window);
  let overlap = 0;
  for (let length = max; length >= 1; length--) {
    if (base.slice(-length) === next.slice(0, length)) {
      overlap = length;
      break;
    }
  }
  const codeFenceBoundary = overlap === 3 && base.endsWith('```') && next.startsWith('```');
  if (overlap < 12 && !codeFenceBoundary) overlap = 0;
  return base + next.slice(overlap);
}

export function reconcileFinalContent(baseContent = '', runContent = '', finalContent) {
  const streamed = baseContent + runContent;
  if (finalContent == null) {
    return baseContent ? safeMerge(baseContent, runContent) : runContent;
  }
  if (!baseContent && !runContent) return finalContent;
  if (finalContent.startsWith(baseContent)) {
    if (!baseContent && finalContent.length < streamed.length) return streamed;
    return finalContent;
  }
  return safeMerge(baseContent, runContent);
}

export function finalContentPatch(usage = {}, baseContent = '', runContent = '') {
  return {
    ...(usage.finalContent != null
      ? { content: reconcileFinalContent(baseContent, runContent, usage.finalContent) }
      : {}),
    tailTrimmed: usage.tailTrimmed === true,
    repairAttempted: usage.repairAttempted === true,
    completionRepaired: usage.completionRepaired === true,
    repairSegments: Number.isInteger(usage.repairSegments) ? usage.repairSegments : 0,
    rawFinishReason: usage.rawFinishReason,
    normalizedFinishReason: usage.normalizedFinishReason,
    completionStatus: usage.completionStatus,
    incomplete: usage.incomplete === true,
    continuationExhausted: usage.continuationExhausted === true,
    finalizationReason: usage.finalizationReason,
    contentAnalysisReason: usage.contentAnalysisReason,
    hasRemainingContent: usage.hasRemainingContent === true,
    segmentIndex: usage.segmentIndex,
    totalSegments: usage.totalSegments,
    completedSections: usage.completedSections,
    remainingSections: usage.remainingSections,
  };
}
