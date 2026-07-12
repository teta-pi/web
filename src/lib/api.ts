import type {
  AuthToken,
  Block,
  Business,
  EndpointVerifyResult,
  IntentResolution,
  RegistrySearchResult,
  SearchResult,
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

  setPassword: (password: string, token: string): Promise<{ message: string }> =>
    request("/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }, token),

  changeEmail: (newEmail: string, token: string): Promise<{ message: string }> =>
    request("/auth/change-email", {
      method: "POST",
      body: JSON.stringify({ new_email: newEmail }),
    }, token),

  confirmEmailChange: (newEmail: string, code: string, token: string): Promise<{ message: string; email: string }> =>
    request("/auth/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ new_email: newEmail, code }),
    }, token),

  logoutAll: (token: string): Promise<AuthToken> =>
    request("/auth/logout-all", { method: "POST" }, token),

  deleteAccount: (token: string): Promise<{ status: string }> =>
    request("/auth/delete-account", { method: "POST" }, token),

  personalApiKey: (token: string): Promise<{ api_key: string; note: string }> =>
    request("/auth/personal-api-key", { method: "POST" }, token),

  me: (token: string): Promise<{
    id: string; email: string; full_name: string | null; role: string;
    avatar_url: string | null; has_password: boolean; has_api_key: boolean;
  }> => request("/auth/me", {}, token),

  uploadAvatar: async (file: File, token: string): Promise<{ avatar_url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/v1/auth/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof err.detail === "string" ? err.detail : "Upload failed");
    }
    return res.json();
  },
};

/** Absolute URL for media paths returned by the API (e.g. /media/local/...). */
export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}/api/v1${path}`;
}

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

  exportUser: (token: string, id: string) =>
    request<Record<string, unknown>>(`/admin/users/${id}/export`, {}, token),

  anonymizeUser: (token: string, id: string) =>
    request<{ status: string }>(`/admin/users/${id}/anonymize`, { method: "POST" }, token),

  userFlags: (token: string, id: string) =>
    request<{ flags: string[] }>(`/admin/users/${id}/flags`, {}, token),

  validateEntity: (token: string, id: string) =>
    request<{ status: string; matches: number }>(`/admin/entities/${id}/validate`, { method: "POST" }, token),

  analytics: (token: string, days = 14) =>
    request<AdminAnalytics>(`/admin/analytics?days=${days}`, {}, token),

  productMetrics: (token: string, days = 30) =>
    request<AdminProductMetrics>(`/admin/product-metrics?days=${days}`, {}, token),

  healthCheck: (token: string) =>
    request<AdminHealthCheck>("/admin/health-check", {}, token),
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

export interface AdminAnalytics {
  available: boolean;
  totals?: {
    last_24h: number | null;
    last_7d: number | null;
    last_30d: number | null;
    all_time: number | null;
  };
  daily?: { day: string; total: number }[];
  top_paths?: { path: string; title: string; total: number }[];
  top_referrers?: { ref: string; total: number }[];
  browsers?: { name: string; total: number }[];
  systems?: { name: string; total: number }[];
  locations?: { location: string; total: number }[];
  sizes?: { bucket: string; total: number }[];
}

export interface AdminHealthCheck {
  checked_at: string;
  api: { ok: boolean; status_code: number | null };
  mcp: { ok: boolean; status_code: number | null };
  stats: { ok: boolean; status_code: number | null };
}

export interface AdminProductMetrics {
  entity_growth: { day: string; total: number }[];
  verification_events_daily: { day: string; total: number }[];
  entities_by_type: Record<string, number>;
  funnel: {
    claims: number;
    signed_up: number;
    created_entity: number;
    verified: number;
  };
  registry_search_health: { available: boolean; note?: string };
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
    token?: string,
    order?: number
  ): Promise<Block> =>
    request(
      `/businesses/${businessId}/blocks`,
      { method: "POST", body: JSON.stringify({ title, description, order }) },
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

// Verification methods (verification rework — docs/verification-rework.md §2).
// Appended here because api.ts is append-only. Each method is owner-triggered
// and writes an append-only verification_events row on success. Document upload
// is intentionally absent — it is UI-only ("Coming soon") until the backend
// upload/review flow ships, so there is no client call for it.

// Instructions returned by /verify/domain/start — DNS TXT record + well-known
// file token, same mechanism as the WordPress plugin.
export interface DomainVerifyInstructions {
  domain: string;
  token: string;
  dns_txt: { host: string; value: string };
  file: { url: string; content: string };
  expires_in: number;
}

// Public brand→legal-entity disclosure (from the by-slug/public payload).
export interface PublicLegalEntity {
  id: string;
  name: string;
  slug: string;
  registry_status: string;
}

export const verifyApi = {
  // Official Registry Match — runs in a background task; poll businessApi.get
  // for registry_status ("verified" | "not_found") afterwards.
  registry: (id: string, token: string): Promise<{ message: string }> =>
    request(`/businesses/${id}/verify/registry`, { method: "POST" }, token),

  // Business Email Control — 6-digit code to an address on the brand's domain.
  emailStart: (id: string, email: string, token: string): Promise<{ message: string }> =>
    request(`/businesses/${id}/verify/email/start`, { method: "POST", body: JSON.stringify({ email }) }, token),

  emailConfirm: (id: string, email: string, code: string, token: string): Promise<{ verified: boolean; email: string }> =>
    request(`/businesses/${id}/verify/email/confirm`, { method: "POST", body: JSON.stringify({ email, code }) }, token),

  // Domain Ownership — get DNS TXT / well-known instructions, then check.
  domainStart: (id: string, domain: string, token: string): Promise<DomainVerifyInstructions> =>
    request(`/businesses/${id}/verify/domain/start`, { method: "POST", body: JSON.stringify({ domain }) }, token),

  domainCheck: (id: string, domain: string, token: string): Promise<{ verified: boolean; domain?: string; method?: string }> =>
    request(`/businesses/${id}/verify/domain/check`, { method: "POST", body: JSON.stringify({ domain }) }, token),

  // Brand → verified legal entity link (Google→Alphabet). Publicly disclosed.
  linkLegalEntity: (id: string, legalEntityId: string, token: string): Promise<{ legal_entity_id: string; legal_entity_name: string }> =>
    request(`/businesses/${id}/legal-entity`, { method: "POST", body: JSON.stringify({ legal_entity_id: legalEntityId }) }, token),

  unlinkLegalEntity: (id: string, token: string): Promise<{ legal_entity_id: null }> =>
    request(`/businesses/${id}/legal-entity`, { method: "DELETE" }, token),
};

// Public entity payload by slug (powers /e/[slug]); read here to surface the
// brand→legal-entity link in the owner dashboard, which BusinessOut omits.
export const publicProfileApi = {
  bySlug: (slug: string): Promise<{ legal_entity: PublicLegalEntity | null } & Record<string, unknown>> =>
    request(`/businesses/by-slug/${slug}/public`),
};
