import "server-only";
import type { AIProvider, AIStatus } from "./types";
import { OllamaProvider } from "./providers/ollama";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";

/**
 * Registro de provedores. Para adicionar um novo provedor:
 * 1. implemente `AIProvider` em ./providers;
 * 2. adicione um `case` abaixo lendo suas variáveis de ambiente.
 * Nenhuma outra parte do sistema precisa mudar.
 */
export function getAIStatus(): AIStatus {
  const id = (process.env.AI_PROVIDER ?? "none").toLowerCase();
  switch (id) {
    case "ollama": {
      const model = process.env.OLLAMA_MODEL;
      return model
        ? { configured: true, providerId: id, label: "Ollama (local)", model, message: `Ollama em ${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}` }
        : { configured: false, providerId: id, label: "Ollama (local)", model: null, message: "AI_PROVIDER=ollama, mas OLLAMA_MODEL não foi definido." };
    }
    case "openai_compatible": {
      const base = process.env.AI_BASE_URL;
      const model = process.env.AI_MODEL;
      return base && model
        ? { configured: true, providerId: id, label: "Servidor compatível (chat/completions)", model, message: `Endpoint ${base}` }
        : { configured: false, providerId: id, label: "Servidor compatível (chat/completions)", model: null, message: "Defina AI_BASE_URL e AI_MODEL." };
    }
    default:
      return {
        configured: false,
        providerId: "none",
        label: "Nenhum",
        model: null,
        message:
          "Nenhum provedor de IA configurado. O FIGHT IQ funciona normalmente com a comparação objetiva e a análise manual; a análise por IA fica indisponível.",
      };
  }
}

export function getAIProvider(): AIProvider | null {
  const status = getAIStatus();
  if (!status.configured) return null;
  switch (status.providerId) {
    case "ollama":
      return new OllamaProvider(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434", status.model!);
    case "openai_compatible":
      return new OpenAICompatibleProvider(process.env.AI_BASE_URL!, status.model!, process.env.AI_API_KEY);
    default:
      return null;
  }
}
