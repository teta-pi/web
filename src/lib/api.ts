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

// Back office (admin-gated endpoints)
export const adminApi = {
  stats: (token: string) => request<{
    users: { total: number; today: number; week: number };
    claims: { total: number; pay_ready: number; pay_ready_pct: number };
    entities: { total: number; by_level: Record<string, number> };
    verification_events: number;
  }>("/admin/stats", {}, token),

  users: (token: string, params: { q?: string; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.offset) qs.set("offset", String(params.offset));
    return request<{ total: number; results: AdminUser[] }>(`/admin/users?${qs}`, {}, token);
  },

  userDetail: (token: string, id: string) =>
    request<AdminUserDetail>(`/admin/users/${id}`, {}, token),

  claims: (token: string, params: { offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.offset) qs.set("offset", String(params.offset));
    return request<{ total: number; results: AdminClaim[] }>(`/admin/claims?${qs}`, {}, token);
  },

  entities: (token: string, params: { q?: string; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.offset) qs.set("offset", String(params.offset));
    return request<{ total: number; results: AdminEntity[] }>(`/admin/entities?${qs}`, {}, token);
  },

  auditLog: (token: string, params: { offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.offset) qs.set("offset", String(params.offset));
    return request<{ total: number; results: AdminAuditEntry[] }>(`/admin/audit-log?${qs}`, {}, token);
  },
};

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  auth_provider: string;
  role: string;
  is_active: boolean;
  is_agent: boolean;
  created_at: string;
  entities_count: number;
}

export interface AdminUserDetail {
  user: AdminUser & { updated_at: string };
  entities: AdminEntity[];
  verification_events: {
    id: string;
    entity_id: string;
    event_type: string;
    level: number;
    source: string;
    ots_status: string;
    btc_block: number | null;
    created_at: string;
  }[];
}

export interface AdminClaim {
  id: string;
  position: number;
  email: string;
  entity_type: string;
  ready_to_pay: boolean;
  source: Record<string, string | null> | null;
  created_at: string;
}

export interface AdminEntity {
  id: string;
  name: string;
  slug: string;
  entity_type: string;
  segment?: string;
  verification_level: string;
  registry_status: string;
  registry_id: string | null;
  country: string | null;
  owner_email?: string;
  is_published: boolean;
  is_public: boolean;
  t_score?: number;
  p_score?: number;
  created_at: string;
}

export interface AdminAuditEntry {
  id: string;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

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
