// src/common/types.ts
export interface User {
  id: number;
  name: string;
  // Preferences might become more generic or specific to modules
}

export interface Genre {
  id: number;
  name: string;
}

export interface WatchProviderDetail {
    provider_id: number;
    provider_name: string;
    logo_path: string | null;
    display_priority?: number; // TMDB often includes this
}

export interface WatchProviderRegionData {
    link?: string;
    flatrate?: WatchProviderDetail[];
    rent?: WatchProviderDetail[];
    buy?: WatchProviderDetail[];
}

export interface WatchProviders {
    // Key is region code, e.g., "US", "GB"
    [regionCode: string]: WatchProviderRegionData;
}

// Cast member type
export interface CastMember {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
}

// Review type
export interface Review {
    author: string;
    content: string;
    created_at: string;
    url: string;
}