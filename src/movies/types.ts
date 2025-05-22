import type { Genre } from '../common/types';

export interface Movie {
  id: number; // Our DB id
  tmdb_id: number;
  title: string;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Genre[]; // Store as JSON in DB, parse to objects
}

export interface UserMovieRating {
    user_id: number;
    movie_id: number; // Our DB movie id
    rating: number; // 1-5 or 1-10 scale
}


export interface Movie {
  id: number; // Our DB id
  tmdb_id: number;
  title: string;
  overview: string;
  release_date: string; // YYYY-MM-DD
  vote_average: number; // TMDB's vote_average (0-10)
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Genre[];
  runtime?: number; // From TMDB details, in minutes
  original_language?: string; // From TMDB details e.g. "en"
  // We'll need to fetch and store IMDb ID if we want to filter by IMDb rating specifically
  // TMDB API has `imdb_id` in the movie details response (under `external_ids` if not directly)
  imdb_id?: string | null; // To store from TMDB
}

export interface UserMovieRating {
    user_id: number;
    movie_id: number; // Our DB movie id
    rating: number; // User's own rating (e.g. 1-5)
}

export interface UserMoviePreferences {
    user_id: number;
    preferred_genres?: string[]; // Array of genre names
    preferred_languages?: string[]; // Array of ISO 639-1 language codes
    release_year_min?: number;
    release_year_max?: number;
    duration_min_minutes?: number;
    duration_max_minutes?: number;
    min_imdb_rating?: number; // This implies we need IMDb ratings for movies
    preferred_streaming_providers?: string[]; // Array of provider names (e.g., "Netflix", "Amazon Prime Video")
}