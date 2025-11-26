import { AsyncLocalStorage } from "async_hooks";

export interface AIConfigContext {
    provider: string;
    modelId: string;
    baseUrl?: string;
    apiKey?: string;
    modelType: "chat" | "embedding";
}

export const aiContext = new AsyncLocalStorage<AIConfigContext>();
