export type VerificationLevel = "none" | "registry" | "partial" | "full" | "live";
export type EntityType = "business" | "person" | "organization";

export interface RegistryData {
  registry: string;
  registration_number: string;
  legal_name: string;
  status: string;
  founded?: string;
  address?: string;
  verified_at: string;
}

export interface MediaItem {
  id: string;
  type: "video" | "photo" | "file";
  storage_url: string;
  c2pa_verified: boolean;
  c2pa_signer: string | null;
  bitcoin_confirmed: boolean;
  bitcoin_block: number | null;
  uploaded_at: string;
}

export interface Block {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  order: number;
  is_public: boolean;
  verification_status: string;
  media: MediaItem[];
  created_at: string;
}

export interface Business {
  id: string;
  entity_type: EntityType;
  name: string;
  slug: string;
  description: string | null;
  country: string | null;
  registry_id: string | null;
  registry_status: "pending" | "verified" | "failed" | "multiple_matches";
  registry_data: RegistryData | null;
  verification_level: VerificationLevel;
  ai_categories: Record<string, unknown> | null;
  agent_endpoint: string | null;
  agent_endpoint_verified: boolean;
  is_public: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  blocks?: Block[];
}

export interface SearchResult {
  id: string;
  entity_type: EntityType;
  name: string;
  slug: string;
  description: string | null;
  verification_level: VerificationLevel;
  badges: string[];
  relevance_score: number;
  country: string | null;
  block_count: number;
  registry_id: string | null;
  registry_data: RegistryData | null;
  ai_categories: Record<string, unknown> | null;
  agent_endpoint: string | null;
  agent_endpoint_verified: boolean;
}

// UI-level search result with derived display fields
export interface DisplaySearchResult extends SearchResult {
  accentColor: string;
  levelLabel: string;
  iso: string;
  authority: string;
  requirement: string;
  registryId: string;
  hash: string;
  badgePills: Array<{ text: string }>;
  hasVideo: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  auth_provider: string;
  is_active: boolean;
  is_agent: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface RegistrySearchResult {
  registration_number: string;
  legal_name: string;
  status: string;
  founded?: string;
  address?: string;
  registry: string;
  country: string;
}

export interface EndpointVerifyResult {
  endpoint: string;
  entity_id: string | null;
  is_active: boolean;
  belongs_to_entity: boolean;
  data_consistent: boolean;
  last_checked: string;
  verification_proof: string | null;
}

export interface IntentResolution {
  entity_id: string;
  entity_type: EntityType;
  entity_name: string;
  relevance_score: number;
  verification_level: VerificationLevel;
  agent_endpoint: string | null;
  agent_endpoint_verified: boolean;
  country: string | null;
  registry_id: string | null;
}

export const LEVEL_ACCENT: Record<VerificationLevel, string> = {
  none: "#9991AC",
  registry: "#B8B2C8",
  partial: "#E8640C",
  full: "#6B3FA0",
  live: "#6B3FA0",
};

export const LEVEL_LABEL: Record<VerificationLevel, string> = {
  none: "Unverified",
  registry: "Registry Only",
  partial: "Partial",
  full: "Full Verification",
  live: "Live Verified",
};

export const LEVEL_HASH: Record<VerificationLevel, string> = {
  none: "",
  registry: "#registry:attested",
  partial: "#btc:ts:confirmed · c2pa:pending",
  full: "#c2pa:verified · btc:ts:confirmed",
  live: "#c2pa:verified · btc:ts:confirmed · live",
};

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  business: "Business",
  person: "Person",
  organization: "Organization",
};
