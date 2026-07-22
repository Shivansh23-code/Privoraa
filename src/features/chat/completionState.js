export function completionNotice(message = {}) {
  if (message.aborted || message.completionStatus === 'aborted') return null;
  if (message.finishReason === 'content_filter' || message.finishReason === 'safety') {
    return 'The provider stopped this response for safety reasons.';
  }
  if (message.completionStatus === 'limit_reached') {
    return 'This answer reached the maximum response length.';
  }
  if (message.completionStatus === 'incomplete') {
    return 'The connection ended before the response completed.';
  }
  return null;
}

export function canContinueResponse(message = {}) {
  return message.role === 'assistant' && !message.pending && !message.aborted
    && (message.incomplete === true
      || message.completionStatus === 'incomplete'
      || message.completionStatus === 'limit_reached');
}
