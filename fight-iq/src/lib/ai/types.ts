export interface AIMessage {
  role: "system" | "user";
  content: string;
}

export interface AICompletion {
  provider: string;
  model: string;
  content: string;
}

/** Contrato que qualquer provedor de IA precisa cumprir. */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  complete(messages: AIMessage[], opts?: { signal?: AbortSignal }): Promise<AICompletion>;
}

export interface AIStatus {
  configured: boolean;
  providerId: string;
  label: string;
  model: string | null;
  message: string;
}
