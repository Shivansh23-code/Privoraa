export function completionNotice(message = {}) {
  if (message.aborted || message.completionStatus === 'aborted') return null;
  if (message.finishReason === 'content_filter' || message.finishReason === 'safety') {
    return 'The provider stopped this response for safety reasons.';
  }
  if (message.hasRemainingContent === true || message.completionStatus === 'partial'
      || message.finalizationReason === 'PLANNED_SEGMENTATION') {
    return 'This response is organized into sections. Continue when you’re ready for the rest.';
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
      || message.completionStatus === 'limit_reached'
      || message.completionStatus === 'partial'
      || message.hasRemainingContent === true);
}
