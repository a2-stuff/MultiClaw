export interface SharedStateEntry {
  id: string;
  namespace: string;
  key: string;
  value: string | null;
  version: number;
  createdBy: string | null;
  updatedAt: string;
  expiresAt: string | null;
}

export interface KnowledgeEntry {
  id: string;
  content: string;
  metadata: string | null;
  createdBy: string | null;
  createdAt: string;
  hasEmbedding: boolean;
}

export interface SearchResult extends KnowledgeEntry {
  similarity: number;
}
