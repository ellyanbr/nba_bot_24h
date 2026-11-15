import type { AICompletion, AIMessage, AIProvider } from "../types";

/**
 * Provedor genérico para qualquer servidor compatível com a API "chat/completions"
 * (ex.: LM Studio ou llama.cpp server rodando localmente — ambos gratuitos).
 * Também permite conectar serviços externos no futuro, sem alterar o restante do sistema.
 * A chave (se houver) é lida apenas no servidor.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai_compatible";
  readonly label = "Servidor compatível com chat/completions";
  constructor(
    private baseUrl: string,
    readonly model: string,
    private apiKey?: string,
  ) {}

  async complete(messages: AIMessage[], opts?: { signal?: AbortSignal }): Promise<AICompletion> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: this.model, messages, temperature: 0.2 }),
      signal: opts?.signal,
    });
    if (!res.ok) throw new Error(`Provedor respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("O provedor retornou uma resposta vazia.");
    return { provider: this.id, model: this.model, content };
  }
}
