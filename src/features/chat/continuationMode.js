export function assistantRunPlan({ isRegenerate = false, isContinuation = false, targetAssistantMessageId } = {}) {
  if (isContinuation) {
    return { addUserMessage: false, addAssistantMessage: false, assistantId: targetAssistantMessageId };
  }
  return { addUserMessage: !isRegenerate, addAssistantMessage: true, assistantId: null };
}

export function manualContinuationOptions(message) {
  return {
    isContinuation: true,
    targetAssistantMessageId: message.id,
    existingContent: message.content || '',
    modelOverride: message.model,
    providerOverride: message.selectedProvider || message.provider,
  };
}
