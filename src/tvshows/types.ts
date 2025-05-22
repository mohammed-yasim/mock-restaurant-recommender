// src/tvshows/tvShowTypes.ts
import type { Genre } from '../common/types';

export interface TvShow {
  id: number; // Our DB id
  tmdb_id: number;
  name: string;
  overview: string;
  first_air_date: string; // YYYY-MM-DD
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Genre[];
  number_of_seasons?: number;
  episode_run_time?: number[]; // TMDB provides this as an array, usually with one value (avg episode runtime)
  original_language?: string;
  imdb_id?: string | null;
}

export interface UserTvShowRating {
  user_id: number;
  tv_show_id: number;
  rating: number;
}

export interface UserTvShowPreferences {
    user_id: number;
    preferred_genres?: string[];
    preferred_languages?: string[];
    first_air_year_min?: number;
    first_air_year_max?: number;
    avg_episode_duration_min?: number;
    avg_episode_duration_max?: number;
    min_imdb_rating?: number;
    preferred_streaming_providers?: string[];
}