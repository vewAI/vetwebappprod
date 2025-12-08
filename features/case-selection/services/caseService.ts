import type { Case } from "../models/case";

// Proxy reads through our API so Supabase RLS can stay locked down.
const API_BASE_PATH = "/api/case-catalog";

type ApiCase = {
  id?: string;
  slug?: string | null;
  title?: string;
  description?: string | null;
  species?: string | null;
  condition?: string | null;
  category?: string | null;
  difficulty?: string | null;
  estimated_time?: number | string | null;
  image_url?: string | null;
};

export async function fetchCases(): Promise<Case[]> {
  const response = await fetch(API_BASE_PATH, { cache: "no-store" });
  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || "Failed to load cases");
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item) => mapApiCaseToCase(item as ApiCase));
}

export async function fetchCaseById(id: string): Promise<Case | null> {
  if (!id) return null;

  try {
    const response = await fetch(
      `${API_BASE_PATH}/${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const message = await safeReadError(response);
      throw new Error(message || "Failed to load case");
    }

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return mapApiCaseToCase(payload as ApiCase);
  } catch (error) {
    console.error("fetchCaseById error:", error);
    return null;
  }
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as unknown;
    if (data && typeof data === "object" && "error" in data) {
      const { error } = data as { error?: unknown };
      if (typeof error === "string") {
        return error;
      }
    }
  } catch {
    // Ignore JSON parsing failures and fall through to status text
  }

  return response.statusText;
}

function mapApiCaseToCase(dbCase: ApiCase): Case {
  return {
    id: dbCase.id ?? "",
    title: dbCase.title ?? "",
    description: dbCase.description ?? "",
    species: dbCase.species ?? "",
    condition: dbCase.condition ?? "",
    category: dbCase.category ?? "",
    difficulty: (() => {
      const d = String(dbCase.difficulty ?? "");
      if (d === "Hard") return "Hard" as const;
      if (d === "Medium") return "Medium" as const;
      return "Easy" as const;
    })(),
    estimatedTime:
      typeof dbCase.estimated_time === "number"
        ? dbCase.estimated_time
        : Number(dbCase.estimated_time || 0),
    imageUrl: dbCase.image_url ?? "",
  };
}
