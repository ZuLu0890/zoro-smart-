export interface SearchResult {
  id: string;
  type: 'array' | 'proposal' | 'bridge_tx' | 'token';
  title: string;
  subtitle: string;
  /** URL to navigate to on click. */
  url: string;
  /** Optional status badge text. */
  status?: string;
  /** Relevance score 0-1. */
  score: number;
}

export interface SearchRequest {
  query: string;
  types?: string[];
  limit?: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  tookMs: number;
}
