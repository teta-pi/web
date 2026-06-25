import { create } from "zustand";

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;
export type AuthMode = "signup" | "signin";
export type SearchPhase = "idle" | "searching" | "none" | "results";
export type ProvePhase = "idle" | "proving" | "proven";
export type ProveMethod = "domain" | "contact" | "document";
export type EntityKind = "business" | "journalist" | "artist" | "organization";

export interface RegistryEntity {
  name: string;
  registryId: string;
  iso: string;
  authority: string;
  city: string;
  status: string;
  since: string;
}

interface OnboardingState {
  step: OnboardingStep;
  entityKind: EntityKind | null;
  authMode: AuthMode;
  query: string;
  searchPhase: SearchPhase;
  entity: RegistryEntity | null;
  method: ProveMethod | null;
  provePhase: ProvePhase;
  code: string;
  officer: string | null;
  proven: boolean;
  authed: boolean;
  email: string;
  accountEmail: string;
  paired: boolean;
  token: string | null;
  createdEntityId: string | null;

  setStep: (step: OnboardingStep) => void;
  setEntityKind: (kind: EntityKind) => void;
  setAuthMode: (mode: AuthMode) => void;
  setQuery: (q: string) => void;
  setSearchPhase: (phase: SearchPhase) => void;
  setEntity: (entity: RegistryEntity | null) => void;
  setMethod: (method: ProveMethod | null) => void;
  setProvePhase: (phase: ProvePhase) => void;
  setCode: (code: string) => void;
  setOfficer: (officer: string | null) => void;
  setProven: (proven: boolean) => void;
  setAuthed: (authed: boolean) => void;
  setEmail: (email: string) => void;
  setAccountEmail: (email: string) => void;
  setPaired: (paired: boolean) => void;
  setToken: (token: string | null) => void;
  setCreatedEntityId: (id: string | null) => void;
  reset: () => void;
}

const initial = {
  step: 0 as OnboardingStep,
  entityKind: null as EntityKind | null,
  authMode: "signup" as AuthMode,
  query: "",
  searchPhase: "idle" as SearchPhase,
  entity: null,
  method: null,
  provePhase: "idle" as ProvePhase,
  code: "",
  officer: null,
  proven: false,
  authed: false,
  email: "",
  accountEmail: "",
  paired: false,
  token: null as string | null,
  createdEntityId: null as string | null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setEntityKind: (entityKind) => set({ entityKind }),
  setAuthMode: (authMode) => set({ authMode }),
  setQuery: (query) => set({ query }),
  setSearchPhase: (searchPhase) => set({ searchPhase }),
  setEntity: (entity) => set({ entity }),
  setMethod: (method) => set({ method }),
  setProvePhase: (provePhase) => set({ provePhase }),
  setCode: (code) => set({ code }),
  setOfficer: (officer) => set({ officer }),
  setProven: (proven) => set({ proven }),
  setAuthed: (authed) => set({ authed }),
  setEmail: (email) => set({ email }),
  setAccountEmail: (accountEmail) => set({ accountEmail }),
  setPaired: (paired) => set({ paired }),
  setToken: (token) => set({ token }),
  setCreatedEntityId: (createdEntityId) => set({ createdEntityId }),
  reset: () => set(initial),
}));
