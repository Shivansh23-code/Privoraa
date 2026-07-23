export function hasPersistedAssistantIdentity(message) {
  if (!message || message.role !== 'assistant') return false;
  if (message.pending || message.aborted) return false;
  if (message.localOnly) return false;
  if (message.persisted !== true) return false;
  return Boolean(message.id);
}

export function completionNotice(message = {}) {
  if (message.aborted || message.completionStatus === 'aborted') return null;
  if (message.finishReason === 'content_filter' || message.finishReason === 'safety') {
    return 'The provider stopped this response for safety reasons.';
  }
  if (message.hasRemainingContent === true || message.completionStatus === 'partial'
      || message.finalizationReason === 'PLANNED_SEGMENTATION') {
    return 'This response is organized into sections. Continue when you\u2019re ready for the rest.';
  }
  if (message.completionStatus === 'limit_reached') {
    return 'This answer reached the maximum response length.';
  }
  if (message.completionStatus === 'incomplete') {
    return 'The connection ended before the response completed.';
  }
  return null;
}

export function isLegacyEmptyAssistant(message = {}) {
  if (message.role !== 'assistant') return false;
  if (message.pending || message.aborted) return false;
  const content = (message.content || '').trim();
  if (content.length > 0) return false;
  if (message.images && message.images.length > 0) return false;
  if (message.attachments && message.attachments.length > 0) return false;
  if (message.citations && message.citations.length > 0) return false;
  if (message.tool_calls && message.tool_calls.length > 0) return false;
  const failureStatuses = new Set(['incomplete', 'provider_error', 'timeout', 'error']);
  if (!message.completionStatus || !failureStatuses.has(message.completionStatus)) return false;
  if (message.completionTokens != null && message.completionTokens > 0) return false;
  return true;
}

export function hasNonEmptyContent(message = {}) {
  if (message.content && message.content.length > 0) return true;
  if (message.images && message.images.length > 0) return true;
  if (message.attachments && message.attachments.length > 0) return true;
  if (message.citations && message.citations.length > 0) return true;
  return false;
}

export function canContinueResponse(message = {}) {
  if (message.role !== 'assistant') return false;
  if (message.pending || message.aborted) return false;
  if (!hasPersistedAssistantIdentity(message)) return false;
  if (!hasNonEmptyContent(message)) return false;
  return message.incomplete === true
    || message.completionStatus === 'incomplete'
    || message.completionStatus === 'limit_reached'
    || message.completionStatus === 'partial'
    || message.completionStatus === 'provider_error'
    || message.completionStatus === 'timeout'
    || message.completionStatus === 'error'
    || message.hasRemainingContent === true;
}
