import chalk from 'chalk';
import readline from 'readline';
import type { User } from '../common/types';
import type { Movie, UserMoviePreferences } from '../movies/types';
import {
    getMovieDetails as getTMDBMovieDetails,
    searchMovies as searchTMDBMovies,
    getPosterUrl,
    getMovieGenreList, // To show available genres
} from '../common/tmdbService';

import type { TMDBMovie as TMDBMovieFromService} from '../common/tmdbService';
import {
    saveMovie, getMovieByTmdbId, saveUserMovieRating, getRatedMovieIdsByUser,
    getUserMoviePreferences, saveUserMoviePreferences, getMovieByOurId
} from '../db/movieDb';
import { getMovieRecommendationsForUser } from '../movies/recommender';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

// Updated displayMovieSummary to handle our Movie type
function displayMovieSummary(movie: Movie, dbId?: number): void {
    console.log(chalk.magenta("\n----------------------------------------"));
    console.log(chalk.bold.yellowBright(`✨ ${movie.title} (${movie.release_date?.substring(0,4) || 'N/A'}) ✨`));
    if (dbId) console.log(chalk.dim(`   Our DB ID: ${dbId}`));
    console.log(chalk.dim(`   TMDB ID: ${movie.tmdb_id}`));
    console.log(`   Rating: ⭐ ${movie.vote_average?.toFixed(1)}/10 (${movie.vote_count} votes)`);
    const genres = movie.genres?.map(g => g.name).join(', ') || 'N/A';
    console.log(`   Genres: ${genres}`);
    console.log(`   Runtime: ${movie.runtime ? `${movie.runtime} min` : 'N/A'}`);
    console.log(`   Language: ${movie.original_language || 'N/A'}`);
    const poster = getPosterUrl(movie.poster_path, 'w154');
    if (poster) console.log(chalk.dim(`   Poster: ${poster}`));
    console.log(chalk.magenta("----------------------------------------"));
}

async function viewMovieDetailsFlow(tmdbMovieId: number): Promise<void> {
    console.log(chalk.cyan(`\nFetching details for TMDB ID: ${tmdbMovieId}...`));
    const details = await getTMDBMovieDetails(tmdbMovieId);
    if (!details) {
        console.log(chalk.red("Could not fetch movie details."));
        return;
    }

    // Save/update in our DB to ensure our local copy is rich
    const movieInDb = await saveMovie(details);

    console.log(chalk.magenta("\n🎬 MOVIE DETAILS 🎬"));
    console.log(chalk.bold.yellowBright(`${details.title} (${details.release_date?.substring(0,4)})`));
    // ... (rest of the detailed display from previous version, using 'details' object)
    console.log(`   TMDB ID: ${details.id}`);
    if(details.imdb_id) console.log(`   IMDb ID: ${details.imdb_id}`);
    console.log(`   Tagline: ${details.tagline || 'N/A'}`);
    console.log(`   Runtime: ${details.runtime ? `${details.runtime} min` : 'N/A'}`);
    console.log(`   Rating: ⭐ ${details.vote_average?.toFixed(1)}/10 (${details.vote_count} votes)`);
    console.log(`   Genres: ${details.genres?.map(g => g.name).join(', ') || 'N/A'}`);
    console.log(chalk.cyan("\n--- Overview ---"));
    console.log(details.overview || 'N/A');

    if (details.credits?.cast && details.credits.cast.length > 0) {
        console.log(chalk.cyan("\n--- Cast (Top 5) ---"));
        details.credits.cast.slice(0, 5).forEach(c => console.log(`   ${c.name} as ${c.character}`));
    }

    if (details["watch/providers"]?.results) {
        const providers = details["watch/providers"].results["US"]; // Example: US
        if (providers) {
            console.log(chalk.cyan("\n--- Watch Providers (US) ---"));
            if (providers.flatrate?.length) console.log(chalk.greenBright(`   Stream: ${providers.flatrate.map(p=>p.provider_name).join(', ')}`));
            if (providers.rent?.length) console.log(`   Rent: ${providers.rent.map(p=>p.provider_name).join(', ')}`);
            if (providers.buy?.length) console.log(`   Buy: ${providers.buy.map(p=>p.provider_name).join(', ')}`);
        } else {
            console.log(chalk.gray("   No provider information for US region."));
        }
    }
    
    if(details.reviews?.results && details.reviews.results.length > 0) {
        console.log(chalk.cyan("\n--- Reviews (1) ---"));
        const review = details.reviews.results[0];
        if (review) {
            console.log(`   Author: ${review.author}`);
            console.log(`   "${review.content.substring(0,200)}..."`);
        }
    }
    // ... (poster/backdrop display)
    console.log(chalk.magenta("----------------------------------------"));
}

async function searchAndSelectMovie(): Promise<TMDBMovieFromService | null> { // Returns TMDB type from service
    const query = await ask(chalk.green("Search for a movie: "));
    if (!query.trim()) return null;

    const searchResults = await searchTMDBMovies(query);
    if (!searchResults || searchResults.results.length === 0) {
        console.log(chalk.yellow("No movies found for your search."));
        return null;
    }

    console.log(chalk.cyan("\nSearch Results:"));
    searchResults.results.slice(0, 10).forEach((movie, index) => {
        // Search results might not have full genre objects, so display carefully
        console.log(`${index + 1}. ${movie.title} (${movie.release_date?.substring(0,4) || 'N/A'})`);
    });
    const choice = await ask(chalk.green("Select a movie by number (or 0 to cancel): "));
    const movieIndex = parseInt(choice) - 1;
    if (isNaN(movieIndex) || movieIndex < 0 || movieIndex >= Math.min(10, searchResults.results.length)) {
        return null;
    }
    return searchResults.results[movieIndex] ?? null;
}

async function manageMoviePreferences(userId: number, currentPrefs?: UserMoviePreferences): Promise<UserMoviePreferences> {
    console.log(chalk.cyan("\n--- Manage Movie Preferences ---"));
    let prefs: UserMoviePreferences = currentPrefs || { user_id: userId };

    const allGenres = await getMovieGenreList();
    console.log(chalk.dim("Available genres: " + allGenres.map(g => g.name).join(', ')));
    const genresStr = await ask(chalk.green(`Preferred Genres (comma-sep, current: ${prefs.preferred_genres?.join(', ') || 'Any'}): `));
    prefs.preferred_genres = genresStr.trim() ? genresStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    const langsStr = await ask(chalk.green(`Preferred Languages (e.g., en,es,fr, current: ${prefs.preferred_languages?.join(', ') || 'Any'}): `));
    prefs.preferred_languages = langsStr.trim() ? langsStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : undefined;

    const yearMinStr = await ask(chalk.green(`Min Release Year (e.g., 1990, current: ${prefs.release_year_min ?? 'Any'}): `));
    prefs.release_year_min = yearMinStr.trim() ? parseInt(yearMinStr) : undefined;
    if (isNaN(prefs.release_year_min!)) prefs.release_year_min = undefined;

    const yearMaxStr = await ask(chalk.green(`Max Release Year (e.g., 2023, current: ${prefs.release_year_max ?? 'Any'}): `));
    prefs.release_year_max = yearMaxStr.trim() ? parseInt(yearMaxStr) : undefined;
    if (isNaN(prefs.release_year_max!)) prefs.release_year_max = undefined;

    const durMinStr = await ask(chalk.green(`Min Duration (minutes, current: ${prefs.duration_min_minutes ?? 'Any'}): `));
    prefs.duration_min_minutes = durMinStr.trim() ? parseInt(durMinStr) : undefined;
    if (isNaN(prefs.duration_min_minutes!)) prefs.duration_min_minutes = undefined;

    const durMaxStr = await ask(chalk.green(`Max Duration (minutes, current: ${prefs.duration_max_minutes ?? 'Any'}): `));
    prefs.duration_max_minutes = durMaxStr.trim() ? parseInt(durMaxStr) : undefined;
    if (isNaN(prefs.duration_max_minutes!)) prefs.duration_max_minutes = undefined;
    
    const tmdbRatingStr = await ask(chalk.green(`Min TMDB Rating (0-10, current: ${prefs.min_imdb_rating ?? 'Any'}): `));
    prefs.min_imdb_rating = tmdbRatingStr.trim() ? parseFloat(tmdbRatingStr) : undefined;
    if (isNaN(prefs.min_imdb_rating!)) prefs.min_imdb_rating = undefined;

    // Provider selection could be improved by fetching /watch/providers/movie and letting user pick from a list
    const providersStr = await ask(chalk.green(`Preferred Streaming Providers (comma-sep names, e.g. Netflix,Hulu, current: ${prefs.preferred_streaming_providers?.join(', ') || 'Any'}): `));
    prefs.preferred_streaming_providers = providersStr.trim() ? providersStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    await saveUserMoviePreferences(prefs);
    console.log(chalk.green("Movie preferences updated!"));
    return prefs;
}

export async function runMovieCLI(currentUser: User): Promise<void> {
    let userMoviePrefs = await getUserMoviePreferences(currentUser.id);
    if (!userMoviePrefs) {
        console.log(chalk.yellow("No movie preferences set yet. Using defaults. You can change this in option 4."));
        userMoviePrefs = { user_id: currentUser.id }; // Initialize with user_id
        // Optionally save these "empty" (just user_id) preferences or wait for user to explicitly set them
        // await saveUserMoviePreferences(userMoviePrefs);
    }

    let exitMovieMenu = false;
    while (!exitMovieMenu) {
        console.log(chalk.bold.blue("\n--- Movie Recommender Menu ---"));
        console.log("1. Get Movie Recommendations");
        console.log("2. Rate a Movie");
        console.log("3. Search and View Movie Details");
        console.log("4. Manage My Movie Preferences");
        console.log("0. Back to Main Menu");
        const choice = await ask(chalk.green("Choose an option: "));

        switch (choice) {
            case '1': {
                console.log(chalk.cyan("\nFetching movie recommendations..."));
                if (!userMoviePrefs || Object.values(userMoviePrefs).filter(v => v !== undefined && v !== null).length <= 1) {
                    console.log(chalk.yellow("Your movie preferences seem very general or not set."));
                    console.log(chalk.yellow("Please set your preferences (Option 4) for better results."));
                }
                const ratedMovieOurDbIds = await getRatedMovieIdsByUser(currentUser.id); // Gets our DB IDs
                const ratedMoviesInDb = (await Promise.all(ratedMovieOurDbIds.map(id => getMovieByOurId(id)))).filter(m => m) as Movie[];
                const excludeTmdbIds = new Set(ratedMoviesInDb.map(m => m.tmdb_id));

                const recommendations = await getMovieRecommendationsForUser(currentUser, excludeTmdbIds);
                if (recommendations.length === 0) {
                    console.log(chalk.yellow("No movie recommendations available based on current criteria. Try rating more movies or adjusting preferences."));
                } else {
                    console.log(chalk.bold.yellowBright("\nTop Movie Recommendations for You:"));
                    recommendations.forEach(movie => displayMovieSummary(movie, movie.id));
                }
                break;
            }
            case '2': {
                const tmdbMovieFromSearch = await searchAndSelectMovie(); // This is TMDBMovieFromService type
                if (tmdbMovieFromSearch) {
                    // Fetch full details to ensure all fields are present for saving and display
                    const detailedMovieData = await getTMDBMovieDetails(tmdbMovieFromSearch.id);
                    if (!detailedMovieData) {
                        console.log(chalk.red("Could not fetch full details for the selected movie."));
                        break;
                    }
                    // Save (or update) to our DB. saveMovie returns our internal Movie type.
                    const movieInDb = await saveMovie(detailedMovieData);
                    if (!movieInDb) {
                         console.log(chalk.red("Error saving movie to our database. Cannot rate."));
                         break;
                    }
                    displayMovieSummary(movieInDb, movieInDb.id); // Display our Movie type

                    const ratingStr = await ask(chalk.green(`Rate "${movieInDb.title}" (1-5, or 0 to skip): `));
                    const rating = parseInt(ratingStr);
                    if (rating >= 1 && rating <= 5) {
                        await saveUserMovieRating(currentUser.id, movieInDb.id, rating);
                        console.log(chalk.green(`Rated "${movieInDb.title}" ${rating} stars. Thanks!`));
                    }
                }
                break;
            }
            case '3': {
                const tmdbMovieFromSearch = await searchAndSelectMovie();
                if(tmdbMovieFromSearch) {
                    await viewMovieDetailsFlow(tmdbMovieFromSearch.id);
                }
                break;
            }
            case '4': {
                userMoviePrefs = await manageMoviePreferences(currentUser.id, userMoviePrefs);
                break;
            }
            case '0':
                exitMovieMenu = true;
                break;
            default:
                console.log(chalk.red("Invalid option."));
        }
    }
}