import { z } from "zod";

export const LocalAIModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  modelType: z.enum(["chat", "embedding"]),
  modelId: z.string(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefaultChat: z.boolean().optional(),
  isDefaultEmbedding: z.boolean().optional(),
  defaultParams: z.any().optional(),
  dimension: z.number().optional().nullable(),
});

export type LocalAIModel = z.infer<typeof LocalAIModelSchema>;

const STORAGE_KEY = "local_ai_models";
const ACTIVE_MODEL_KEY = "active_local_model_id";

export function getLocalAIModels(): LocalAIModel[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse local AI models", e);
    return [];
  }
}

export function saveLocalAIModels(models: LocalAIModel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
}

export function addLocalAIModel(model: LocalAIModel) {
  const models = getLocalAIModels();
  const existingIndex = models.findIndex((m) => m.id === model.id);
  if (existingIndex >= 0) {
    models[existingIndex] = model;
  } else {
    models.push(model);
  }
  saveLocalAIModels(models);
}

export function deleteLocalAIModel(id: string) {
  const models = getLocalAIModels().filter((m) => m.id !== id);
  saveLocalAIModels(models);
  if (getActiveLocalModelId() === id) {
    setActiveLocalModelId(null);
  }
}

export function getActiveLocalModelId(): string | null {
  return localStorage.getItem(ACTIVE_MODEL_KEY);
}

export function setActiveLocalModelId(id: string | null) {
  if (id) {
    localStorage.setItem(ACTIVE_MODEL_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_MODEL_KEY);
  }
}

export function getActiveLocalModel(): LocalAIModel | null {
  const id = getActiveLocalModelId();
  if (!id) return null;
  const models = getLocalAIModels();
  return models.find((m) => m.id === id) || null;
}

export function getLocalAIConfigHeader(): string | null {
  const model = getActiveLocalModel();
  if (!model) return null;

  // Only send necessary sensitive info
  const config = {
    provider: model.provider,
    modelId: model.modelId,
    baseUrl: model.baseUrl,
    apiKey: model.apiKey,
    modelType: model.modelType,
  };
  
  // Base64 encode to avoid header parsing issues with special chars
  try {
    return btoa(JSON.stringify(config));
  } catch (e) {
    console.error("Failed to encode local AI config", e);
    return null;
  }
}
