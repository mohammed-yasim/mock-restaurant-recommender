// src/common/tmdbService.ts
import chalk from 'chalk';
import type { Genre, WatchProviders, CastMember, Review, WatchProviderDetail } from './types'; // Common types

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

// --- Helper Types ---
interface TMDBPaginatedResponse<T> {
    page: number;
    results: T[];
    total_pages: number;
    total_results: number;
}

// --- Core Fetch Function ---
async function fetchTMDB<T>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
    method: 'GET' | 'POST' = 'GET', // Added method for potential future POST requests
    body?: any // For POST requests
): Promise<T | null> {
    if (!TMDB_API_KEY) {
        console.error(chalk.red.bold("TMDB_API_KEY not found in .env file. Please set it."));
        return null;
    }

    const urlParams = new URLSearchParams({
        api_key: TMDB_API_KEY,
        ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });

    const url = `${TMDB_BASE_URL}/${endpoint}?${urlParams.toString()}`;
    // console.log(chalk.dim(`[TMDB Fetch] ${method} ${url.replace(TMDB_API_KEY, "TMDB_KEY_REDACTED")}`));

    try {
        const fetchOptions: RequestInit = { method };
        if (method === 'POST' && body) {
            fetchOptions.body = JSON.stringify(body);
            fetchOptions.headers = { 'Content-Type': 'application/json' };
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            const errorData: any = await response.json().catch(() => ({
                message: "Failed to parse error JSON from TMDB API response.",
                status_code: response.status // TMDB specific error code
            }));
            console.error(
                chalk.red(`[TMDB API Error] ${response.status} for ${endpoint}:`),
                errorData.status_message || errorData.message || response.statusText
            );
            if (errorData.status_code === 7 || errorData.status_code === 34) { // Invalid API key or Resource not found
                 console.error(chalk.yellow("Please double-check your TMDB_API_KEY and the endpoint."));
            }
            return null;
        }
        return (await response.json()) as T;
    } catch (error) {
        console.error(chalk.red(`[TMDB Network Error] Failed to fetch ${endpoint}:`), error);
        return null;
    }
}

// --- MOVIE Specific TMDB Data Structures & Functions ---
export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    release_date: string | null; // Can be null for some entries
    vote_average: number;
    vote_count: number;
    poster_path: string | null;
    backdrop_path: string | null;
    genre_ids?: number[]; // Popular/Search results often have only genre_ids
    genres?: Genre[];    // Details endpoint provides full genre objects
    runtime?: number | null;
    original_language?: string | null;
    imdb_id?: string | null; // Usually on details, or via external_ids
    tagline?: string | null;
    popularity?: number;
    credits?: { cast: CastMember[] };
    reviews?: TMDBPaginatedResponse<Review>;
    "watch/providers"?: { results: WatchProviders }; // Note: key has /
    external_ids?: { imdb_id?: string | null; facebook_id?: string | null; wikidata_id?: string | null; instagram_id?: string | null; twitter_id?: string | null; };
}

export async function getMovieDetails(movieId: number): Promise<TMDBMovie | null> {
    return fetchTMDB<TMDBMovie>(`movie/${movieId}`, {
        append_to_response: 'credits,reviews,watch/providers,external_ids'
    });
}

export async function getPopularMovies(page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie> | null> {
    return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('movie/popular', { page });
}

export async function searchMovies(query: string, page: number = 1, year?: number): Promise<TMDBPaginatedResponse<TMDBMovie> | null> {
    const params: Record<string, string | number> = { query, page };
    if (year) params.year = year;
    return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>('search/movie', params);
}

export async function getMovieRecommendations(movieId: number, page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie> | null> {
    return fetchTMDB<TMDBPaginatedResponse<TMDBMovie>>(`movie/${movieId}/recommendations`, { page });
}

// --- TV SHOW Specific TMDB Data Structures & Functions ---
export interface TMDBTvShow {
    id: number;
    name: string;
    imdb_id?: string | null;
    overview: string;
    first_air_date: string | null;
    vote_average: number;
    vote_count: number;
    poster_path: string | null;
    backdrop_path: string | null;
    genre_ids?: number[];
    genres?: Genre[];
    number_of_seasons?: number | null;
    number_of_episodes?: number | null;
    episode_run_time?: number[] | null; // Typically an array with one average runtime
    original_language?: string | null;
    tagline?: string | null;
    popularity?: number;
    status?: string; // e.g., "Returning Series", "Ended", "Canceled"
    seasons?: TMDBSeasonSummary[]; // Summary of seasons often included in TV details
    credits?: { cast: CastMember[] };
    reviews?: TMDBPaginatedResponse<Review>;
    "watch/providers"?: { results: WatchProviders };
    external_ids?: { imdb_id?: string | null; tvdb_id?: number | null; facebook_id?: string | null; wikidata_id?: string | null; instagram_id?: string | null; twitter_id?: string | null; };
}

export interface TMDBSeasonSummary { // As returned in TV show details
    air_date: string | null;
    episode_count: number;
    id: number; // TMDB's own ID for the season object
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number; // The actual season number (0 for specials, 1, 2, ...)
}

export interface TMDBFullSeason extends TMDBSeasonSummary { // For specific season details call
    _id?: string; // Internal TMDB ID string for the season object (different from `id`)
    episodes?: TMDBEpisodeSummary[];
}

export interface TMDBEpisodeSummary {
    air_date: string | null;
    episode_number: number;
    id: number; // TMDB's own ID for the episode object
    name: string;
    overview: string;
    production_code?: string | null;
    runtime?: number | null;
    season_number: number;
    show_id?: number; // TMDB ID of the parent TV show
    still_path: string | null;
    vote_average: number;
    vote_count: number;
    // crew?: any[]; // Detailed crew for the episode
    // guest_stars?: any[]; // Detailed guest stars for the episode
}

export async function getTvShowDetails(tvId: number): Promise<TMDBTvShow | null> {
    return fetchTMDB<TMDBTvShow>(`tv/${tvId}`, {
        append_to_response: 'credits,reviews,watch/providers,external_ids'
    });
}

export async function getTvShowSeasonDetails(tvId: number, seasonNumber: number): Promise<TMDBFullSeason | null> {
    // Fetches details for a specific season, usually includes episode summaries
    return fetchTMDB<TMDBFullSeason>(`tv/${tvId}/season/${seasonNumber}`);
}

// Individual episode details are rarely needed if season details are comprehensive enough
// export async function getTvShowEpisodeDetails(tvId: number, seasonNumber: number, episodeNumber: number): Promise<TMDBEpisodeSummary | null> {
// return fetchTMDB<TMDBEpisodeSummary>(`tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);
// }

export async function getPopularTvShows(page: number = 1): Promise<TMDBPaginatedResponse<TMDBTvShow> | null> {
     return fetchTMDB<TMDBPaginatedResponse<TMDBTvShow>>('tv/popular', { page });
}

export async function searchTvShows(query: string, page: number = 1, first_air_date_year?: number): Promise<TMDBPaginatedResponse<TMDBTvShow> | null> {
    const params: Record<string, string | number> = { query, page };
    if (first_air_date_year) params.first_air_date_year = first_air_date_year;
    return fetchTMDB<TMDBPaginatedResponse<TMDBTvShow>>('search/tv', params);
}

export async function getTvShowRecommendations(tvId: number, page: number = 1): Promise<TMDBPaginatedResponse<TMDBTvShow> | null> {
    return fetchTMDB<TMDBPaginatedResponse<TMDBTvShow>>(`tv/${tvId}/recommendations`, { page });
}

// --- GENRE LISTS (Cached) ---
let movieGenreListCache: Genre[] | null = null;
export async function getMovieGenreList(): Promise<Genre[]> {
    if (movieGenreListCache) return movieGenreListCache;
    const response = await fetchTMDB<{ genres: Genre[] }>(`genre/movie/list`);
    if (response && response.genres) {
        movieGenreListCache = response.genres;
        console.log(chalk.dim("[TMDB Service] Movie genres cached."));
        return response.genres;
    }
    return [];
}

let tvGenreListCache: Genre[] | null = null;
export async function getTvShowGenreList(): Promise<Genre[]> {
    if (tvGenreListCache) return tvGenreListCache;
    const response = await fetchTMDB<{ genres: Genre[] }>(`genre/tv/list`);
    if (response && response.genres) {
        tvGenreListCache = response.genres;
        console.log(chalk.dim("[TMDB Service] TV show genres cached."));
        return response.genres;
    }
    return [];
}

// --- GENRE ID MAPPING ---
// (These are more general now, could be moved to a common section if movie/tv genres were merged)
export async function mapMovieGenreIdsToObjects(genre_ids?: number[]): Promise<Genre[]> {
    if (!genre_ids || genre_ids.length === 0) return [];
    const fullGenreList = await getMovieGenreList(); // Uses cached list
    return genre_ids
        .map(id => fullGenreList.find(g => g.id === id))
        .filter(g => g !== undefined) as Genre[];
}

export async function mapTvGenreIdsToObjects(genre_ids?: number[]): Promise<Genre[]> {
    if (!genre_ids || genre_ids.length === 0) return [];
    const fullGenreList = await getTvShowGenreList(); // Uses cached list
    return genre_ids
        .map(id => fullGenreList.find(g => g.id === id))
        .filter(g => g !== undefined) as Genre[];
}

// --- WATCH PROVIDER LISTS (For user preference selection) ---
// Could be cached similarly to genres
export async function getMovieWatchProviders(): Promise<{results: WatchProviderDetail[]} | null> {
    return fetchTMDB<{results: WatchProviderDetail[]}>(`watch/providers/movie`);
}
export async function getTvWatchProviders(): Promise<{results: WatchProviderDetail[]} | null> {
    return fetchTMDB<{results: WatchProviderDetail[]}>(`watch/providers/tv`);
}


// --- UTILITY ---
export function getPosterUrl(
    path: string | null,
    size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'
): string | null {
    return path ? `${TMDB_IMAGE_BASE_URL}${size}${path}` : null;
}

export function getStillUrl( // For episode stills
    path: string | null,
    size: 'w92' | 'w185' | 'w300' | 'original' = 'w300' // TMDB has different sizes for stills
): string | null {
    return path ? `${TMDB_IMAGE_BASE_URL}${size}${path}` : null;
}