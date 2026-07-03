import type {
  AuthToken,
  Block,
  Business,
  EndpointVerifyResult,
  IntentResolution,
  RegistrySearchResult,
  SearchResult,
  User,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail)
    );
  }
  return res.json();
}

// Auth
export const authApi = {
  register: (email: string, password?: string, fullName?: string): Promise<User> =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName }),
    }),

  login: (email: string, password: string): Promise<AuthToken> =>
    request("/auth/token", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  magicLink: (email: string): Promise<{ message: string; dev_token?: string }> =>
    request("/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  sendEmailCode: (email: string): Promise<{ message: string }> =>
    request("/auth/email-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyCode: (email: string, code: string): Promise<AuthToken> =>
    request("/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
};

// Claims — /claim IS the waitlist (LandingSpec v2.1 §02)
export const claimApi = {
  // 201 and 409 both return { position } — duplicate email is idempotent
  create: async (
    email: string,
    entityType: "business" | "journalist" | "creator" | "developer" | "other",
    readyToPay: boolean,
    source?: Record<string, string | null>
  ): Promise<{ position: number }> => {
    const res = await fetch(`${API_BASE}/api/v1/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        entity_type: entityType,
        ready_to_pay: readyToPay,
        source: source ?? null,
      }),
    });
    if (res.status !== 201 && res.status !== 409) {
      throw new Error(`claim failed: ${res.status}`);
    }
    return res.json();
  },

  stats: (): Promise<{ total: number; pay_ready: number; pay_ready_pct: number }> =>
    request("/claim/stats"),
};

// Search
export const searchApi = {
  search: (
    q: string,
    level: string = "any",
    country?: string,
    limit = 10
  ): Promise<SearchResult[]> => {
    const params = new URLSearchParams({ q, level, limit: String(limit) });
    if (country) params.set("country", country);
    return request(`/search?${params}`);
  },

  // Registry search (Identify step in onboarding) — calls government registries directly
  searchRegistry: async (
    companyName: string,
    country?: string
  ): Promise<RegistrySearchResult[]> => {
    const params = new URLSearchParams({ q: companyName });
    if (country) params.set("country", country);
    return request<RegistrySearchResult[]>(`/registry/search?${params}`);
  },
};

// Businesses
export const businessApi = {
  create: (
    name: string,
    description?: string,
    country?: string,
    token?: string,
    entityType?: string
  ): Promise<Business> =>
    request("/businesses", { method: "POST", body: JSON.stringify({ name, description, country, entity_type: entityType ?? "business" }) }, token),

  list: (token: string): Promise<Business[]> =>
    request("/businesses", {}, token),

  get: (id: string): Promise<Business> => request(`/businesses/${id}`),

  update: (
    id: string,
    data: Partial<Business>,
    token?: string
  ): Promise<Business> =>
    request(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  publish: (id: string, token: string): Promise<Business> =>
    request(`/businesses/${id}/publish`, { method: "POST" }, token),

  agentPreview: (id: string): Promise<unknown> => request(`/businesses/${id}/preview`),

  setPrivacy: (id: string, isPublic: boolean, token: string): Promise<Business> =>
    request(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify({ is_public: isPublic }) }, token),

  setAgentEndpoint: (id: string, endpoint: string, token: string): Promise<Business> =>
    request(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify({ agent_endpoint: endpoint }) }, token),
};

// Endpoint Verification
export const endpointApi = {
  verify: (
    endpointUrl: string,
    entityId?: string
  ): Promise<EndpointVerifyResult> =>
    request("/verify-endpoint", {
      method: "POST",
      body: JSON.stringify({ endpoint_url: endpointUrl, entity_id: entityId }),
    }),
};

// Intent Resolution
export const intentApi = {
  resolve: (
    query: string,
    options?: {
      entity_type?: string;
      verified_only?: boolean;
      has_agent_endpoint?: boolean;
    }
  ): Promise<{ query: string; results: IntentResolution[] }> =>
    request("/resolve-intent", {
      method: "POST",
      body: JSON.stringify({ query, ...options }),
    }),
};

// Media
export const mediaApi = {
  upload: async (
    blockId: string,
    file: File,
    type: string,
    token: string
  ): Promise<{ media_id: string; c2pa_verified: boolean; c2pa_signer: string | null; bitcoin_status: string }> => {
    const form = new FormData();
    form.append("file", file);
    form.append("block_id", blockId);
    form.append("type", type);
    form.append("captured_at", new Date().toISOString());
    const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail));
    }
    return res.json();
  },

  verify: (mediaId: string): Promise<unknown> => request(`/media/${mediaId}/verify`),
};

// Blocks
export const blockApi = {
  add: (
    businessId: string,
    title: string,
    description?: string,
    token?: string
  ): Promise<Block> =>
    request(
      `/businesses/${businessId}/blocks`,
      { method: "POST", body: JSON.stringify({ title, description }) },
      token
    ),

  update: (
    blockId: string,
    data: { title?: string; description?: string; order?: number },
    token?: string
  ): Promise<Block> =>
    request(`/blocks/${blockId}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  delete: (blockId: string, token?: string): Promise<void> =>
    request(`/blocks/${blockId}`, { method: "DELETE" }, token),

  reorder: (blockIds: string[], token?: string): Promise<void> =>
    request("/blocks/reorder", { method: "PATCH", body: JSON.stringify({ block_ids: blockIds }) }, token),

  list: (businessId: string): Promise<Block[]> =>
    request(`/businesses/${businessId}/blocks`),
};

export const devices = {
  generateToken: (token: string): Promise<{ token: string; entity_id: string; entity_name: string; expires_in: number }> =>
    request("/devices/generate-token", { method: "POST" }, token),
};
