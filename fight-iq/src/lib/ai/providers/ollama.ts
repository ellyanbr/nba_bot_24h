import type { AICompletion, AIMessage, AIProvider } from "../types";

/**
 * Ollama — execução LOCAL e gratuita de modelos abertos (https://ollama.com).
 * Nenhum dado sai da máquina. Requer o Ollama instalado e um modelo baixado.
 */
export class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  readonly label = "Ollama (local)";
  constructor(
    private baseUrl: string,
    readonly model: string,
  ) {}

  async complete(messages: AIMessage[], opts?: { signal?: AbortSignal }): Promise<AICompletion> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false, options: { temperature: 0.2 } }),
      signal: opts?.signal,
    });
    if (!res.ok) throw new Error(`Ollama respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { message?: { content?: string } };
    const content = json.message?.content?.trim();
    if (!content) throw new Error("Ollama retornou uma resposta vazia.");
    return { provider: this.id, model: this.model, content };
  }
}
