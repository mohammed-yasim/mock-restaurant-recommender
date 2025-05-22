# Project Documentation

This document provides an overview of the project structure and details about its components.

## Project Structure

The project is organized into the following main directories and files:

```
.
├── bun.lockb
├── package.json
├── README.md
├── tsconfig.json
├── src/
│   ├── index.ts        # Main entry point of the application
│   ├── cli/            # Command Line Interface related files
│   │   ├── main.ts
│   │   ├── movie.ts
│   │   ├── restaurant.ts
│   │   └── tvShow.ts
│   ├── common/         # Common utilities and services
│   │   ├── tmdbService.ts  # Service for interacting with The Movie Database (TMDB) API
│   │   └── types.ts        # Common TypeScript types and interfaces
│   ├── data/           # Mock data and data sources
│   │   ├── mockUsers.ts
│   │   └── restaurants.sqlite
│   ├── db/             # Database related files
│   │   ├── movieDb.ts
│   │   ├── restaurantDb.ts
│   │   ├── setup.ts
│   │   └── tvShowDb.ts
│   ├── movies/         # Movie-specific logic
│   │   ├── recommender.ts
│   │   └── types.ts
│   ├── restaurants/    # Restaurant-specific logic
│   │   ├── googleApiService.ts
│   │   ├── recommender.ts
│   │   └── types.ts
│   └── tvshows/        # TV show-specific logic
│       ├── recommender.ts
│       └── types.ts
```

## `src/common/tmdbService.ts`

This file is responsible for all interactions with The Movie Database (TMDB) API. It provides functions to fetch data about movies, TV shows, genres, and watch providers.

### Core Fetch Function

-   **`fetchTMDB<T>(endpoint: string, params?: Record<string, string | number | boolean>, method?: 'GET' | 'POST', body?: any): Promise<T | null>`**
    -   This is a generic function used by all other functions in this service to make requests to the TMDB API.
    -   It handles API key injection, URL construction, request execution, and basic error handling.
    -   It requires the `TMDB_API_KEY` environment variable to be set.
    -   `endpoint`: The API endpoint path (e.g., `movie/popular`).
    -   `params`: An object of query parameters to append to the URL.
    -   `method`: HTTP method, defaults to 'GET'.
    -   `body`: Request body for 'POST' requests.
    -   Returns a Promise that resolves to the fetched data (type `T`) or `null` if an error occurs or the API key is missing.

### Helper Types

-   **`TMDBPaginatedResponse<T>`**: An interface describing the structure of paginated responses from the TMDB API, containing `page`, `results` (an array of type `T`), `total_pages`, and `total_results`.

### Movie Specific Functions and Interfaces

-   **`TMDBMovie`**: Interface defining the structure of a movie object from TMDB. It includes properties like `id`, `title`, `overview`, `release_date`, `vote_average`, `poster_path`, `genres`, `credits`, `reviews`, `watch/providers`, etc.
-   **`getMovieDetails(movieId: number): Promise<TMDBMovie | null>`**: Fetches detailed information for a specific movie, including credits, reviews, watch providers, and external IDs.
-   **`getPopularMovies(page?: number): Promise<TMDBPaginatedResponse<TMDBMovie> | null>`**: Fetches a list of popular movies.
-   **`searchMovies(query: string, page?: number, year?: number): Promise<TMDBPaginatedResponse<TMDBMovie> | null>`**: Searches for movies based on a query string, optionally filtered by year.
-   **`getMovieRecommendations(movieId: number, page?: number): Promise<TMDBPaginatedResponse<TMDBMovie> | null>`**: Fetches movie recommendations for a given movie ID.

### TV Show Specific Functions and Interfaces

-   **`TMDBTvShow`**: Interface defining the structure of a TV show object from TMDB. Includes properties like `id`, `name`, `overview`, `first_air_date`, `number_of_seasons`, `genres`, `credits`, `reviews`, `watch/providers`, etc.
-   **`TMDBSeasonSummary`**: Interface for the summary of a TV show season, often included in TV show details.
-   **`TMDBFullSeason`**: Interface for detailed information about a specific TV show season, including episode summaries.
-   **`TMDBEpisodeSummary`**: Interface for the summary of a TV show episode.
-   **`getTvShowDetails(tvId: number): Promise<TMDBTvShow | null>`**: Fetches detailed information for a specific TV show, including credits, reviews, watch providers, and external IDs.
-   **`getTvShowSeasonDetails(tvId: number, seasonNumber: number): Promise<TMDBFullSeason | null>`**: Fetches details for a specific season of a TV show, including episode summaries.
-   **`getPopularTvShows(page?: number): Promise<TMDBPaginatedResponse<TMDBTvShow> | null>`**: Fetches a list of popular TV shows.
-   **`searchTvShows(query: string, page?: number, first_air_date_year?: number): Promise<TMDBPaginatedResponse<TMDBTvShow> | null>`**: Searches for TV shows based on a query string, optionally filtered by the first air date year.
-   **`getTvShowRecommendations(tvId: number, page?: number): Promise<TMDBPaginatedResponse<TMDBTvShow> | null>`**: Fetches TV show recommendations for a given TV show ID.

### Genre List Functions

These functions fetch and cache lists of movie and TV show genres.

-   **`getMovieGenreList(): Promise<Genre[]>`**: Retrieves a list of all movie genres from TMDB. Results are cached after the first call.
-   **`getTvShowGenreList(): Promise<Genre[]>`**: Retrieves a list of all TV show genres from TMDB. Results are cached after the first call.
-   **`mapMovieGenreIdsToObjects(genre_ids?: number[]): Promise<Genre[]>`**: Maps an array of movie genre IDs to their corresponding full `Genre` objects using the cached genre list.
-   **`mapTvGenreIdsToObjects(genre_ids?: number[]): Promise<Genre[]>`**: Maps an array of TV show genre IDs to their corresponding full `Genre` objects using the cached genre list.
    (Note: `Genre` type is imported from `./types`)

### Watch Provider List Functions

These functions fetch lists of available watch providers for movies and TV shows.

-   **`getMovieWatchProviders(): Promise<{results: WatchProviderDetail[]} | null>`**: Fetches a list of watch providers for movies.
-   **`getTvWatchProviders(): Promise<{results: WatchProviderDetail[]} | null>`**: Fetches a list of watch providers for TV shows.
    (Note: `WatchProviderDetail` type is imported from `./types`)

### Utility Functions

-   **`getPosterUrl(path: string | null, size?: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'): string | null`**: Constructs the full URL for a movie or TV show poster image given its path and an optional size.
-   **`getStillUrl(path: string | null, size?: 'w92' | 'w185' | 'w300' | 'original'): string | null`**: Constructs the full URL for an episode still image given its path and an optional size.

---

This documentation provides a high-level overview. For more specific details, please refer to the source code and inline comments.
