import { useCallback, useEffect, useState } from 'react';
import { fetchLlmHealth, fetchActiveModel } from '../../lib/modelCatalogService';

/**
 * Tracks the active LLM backend for the chat UI: which provider is selected,
 * whether local Ollama is running, and the user's active local model. Lets the
 * header bind to the active local model and show a "running locally" indicator
 * when provider=ollama. Degrades to {provider:null} if the backend is unreachable.
 */
export function useLocalLlm() {
  const [state, setState] = useState({
    provider: null,
    online: false,
    version: null,
    activeModel: null,
  });

  const refresh = useCallback(async () => {
    try {
      const h = await fetchLlmHealth();
      let activeModel = null;
      if (h?.provider === 'ollama') {
        const a = await fetchActiveModel().catch(() => null);
        activeModel = a?.active || null;
      }
      setState({
        provider: h?.provider || null,
        online: !!h?.running,
        version: h?.version || null,
        activeModel,
      });
    } catch {
      setState((s) => ({ ...s, provider: null }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
