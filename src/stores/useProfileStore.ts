import { create } from "zustand";

export type ProfileView = "edit" | "visitor" | "agent";
export type NameStatus = "idle" | "checking" | "verified" | "not_found";
export type MediaSource = "pi_camera" | "file";
export type MediaPhase = "empty" | "signing" | "timestamping" | "done";

export interface BlockMedia {
  source: MediaSource;
  phase: MediaPhase;
}

export interface ProfileBlock {
  id: string;
  title: string;
  desc: string;
  media: BlockMedia | null;
}

export type ProfileEntityKind = "business" | "journalist" | "artist" | "organization";

interface ProfileState {
  view: ProfileView;
  entityKind: ProfileEntityKind;
  companyName: string;
  nameStatus: NameStatus;
  registryData: {
    iso: string;
    authority: string;
    registryId: string;
    status: string;
    city: string;
    since: string;
  } | null;
  description: string;
  blocks: ProfileBlock[];
  dragId: string | null;
  businessId: string | null;
  authToken: string | null;
  savedAt: Date | null;

  setView: (view: ProfileView) => void;
  setEntityKind: (kind: ProfileEntityKind) => void;
  setCompanyName: (name: string) => void;
  setNameStatus: (status: NameStatus) => void;
  setRegistryData: (data: ProfileState["registryData"]) => void;
  setDescription: (desc: string) => void;
  addBlock: (block?: ProfileBlock) => void;
  setBlocks: (blocks: ProfileBlock[]) => void;
  updateBlock: (id: string, patch: Partial<Omit<ProfileBlock, "id">>) => void;
  removeBlock: (id: string) => void;
  setBlockMedia: (id: string, media: BlockMedia | null) => void;
  setDragId: (id: string | null) => void;
  reorderBlocks: (from: number, to: number) => void;
  setBusinessId: (id: string) => void;
  setAuthToken: (token: string) => void;
  setSavedAt: (d: Date | null) => void;
}

let _blockCounter = 1;

export const useProfileStore = create<ProfileState>((set) => ({
  view: "edit",
  entityKind: "business",
  companyName: "",
  nameStatus: "idle",
  registryData: null,
  description: "",
  blocks: [],
  dragId: null,
  businessId: null,
  authToken: null,
  savedAt: null,

  setView: (view) => set({ view }),
  setEntityKind: (entityKind) => set({ entityKind }),
  setCompanyName: (companyName) => set({ companyName }),
  setNameStatus: (nameStatus) => set({ nameStatus }),
  setRegistryData: (registryData) => set({ registryData }),
  setDescription: (description) => set({ description }),
  addBlock: (block) =>
    set((s) => ({
      blocks: [
        ...s.blocks,
        block ?? {
          id: `block-${_blockCounter++}`,
          title: "",
          desc: "",
          media: null,
        },
      ],
    })),
  setBlocks: (blocks) => set({ blocks }),
  updateBlock: (id, patch) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),
  removeBlock: (id) =>
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })),
  setBlockMedia: (id, media) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === id ? { ...b, media } : b)),
    })),
  setDragId: (dragId) => set({ dragId }),
  reorderBlocks: (from, to) =>
    set((s) => {
      const blocks = [...s.blocks];
      const [item] = blocks.splice(from, 1);
      blocks.splice(to, 0, item);
      return { blocks };
    }),
  setBusinessId: (businessId) => set({ businessId }),
  setAuthToken: (authToken) => set({ authToken }),
  setSavedAt: (savedAt) => set({ savedAt }),
}));
