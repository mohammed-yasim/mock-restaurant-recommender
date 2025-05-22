import chalk from 'chalk';
import readline from 'readline';
import type { User } from '../common/types';
import type { TvShow, UserTvShowPreferences } from '../tvshows/types';
import {
    getTvShowDetails as getTMDBTvShowDetails,
    getTvShowSeasonDetails as getTMDBTvShowSeasonDetails,
    searchTvShows as searchTMDBTvShows,
    getPosterUrl,
    getTvShowGenreList,
} from '../common/tmdbService';
import type { TMDBTvShow as TMDBTvShowFromService } from '../common/tmdbService';
import {
    saveTvShow, getTvShowByTmdbId, saveUserTvShowRating, getRatedTvShowIdsByUser,
    getUserTvShowPreferences, saveUserTvShowPreferences, getTvShowByOurId
} from '../db/tvShowDb';
import { getTvShowRecommendationsForUser } from '../tvshows/recommender';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

function displayTvShowSummary(show: TvShow, dbId?: number): void {
    console.log(chalk.magenta("\n----------------------------------------"));
    console.log(chalk.bold.yellowBright(`📺 ${show.name} (${show.first_air_date?.substring(0,4) || 'N/A'}) ✨`));
    if (dbId) console.log(chalk.dim(`   Our DB ID: ${dbId}`));
    console.log(chalk.dim(`   TMDB ID: ${show.tmdb_id}`));
    console.log(`   Rating: ⭐ ${show.vote_average?.toFixed(1)}/10 (${show.vote_count} votes)`);
    console.log(`   Genres: ${show.genres?.map(g => g.name).join(', ') || 'N/A'}`);
    const avgRuntime = show.episode_run_time && show.episode_run_time.length > 0 ? show.episode_run_time[0] : null;
    console.log(`   Avg Ep Runtime: ${avgRuntime ? `${avgRuntime} min` : 'N/A'}`);
    console.log(`   Language: ${show.original_language || 'N/A'}`);
    const poster = getPosterUrl(show.poster_path, 'w154');
    if (poster) console.log(chalk.dim(`   Poster: ${poster}`));
    console.log(chalk.magenta("----------------------------------------"));
}

async function viewTvShowDetailsFlow(tmdbShowId: number): Promise<void> {
    console.log(chalk.cyan(`\nFetching details for TV Show TMDB ID: ${tmdbShowId}...`));
    const details = await getTMDBTvShowDetails(tmdbShowId);
    if (!details) {
        console.log(chalk.red("Could not fetch TV show details."));
        return;
    }
    await saveTvShow(details); // Save/update in our DB

    console.log(chalk.magenta("\n🎬 TV SHOW DETAILS 🎬"));
    console.log(chalk.bold.yellowBright(`${details.name} (${details.first_air_date?.substring(0,4)})`));
    console.log(`   TMDB ID: ${details.id}`);
    if(details.external_ids?.imdb_id) console.log(`   IMDb ID: ${details.external_ids.imdb_id}`);
    console.log(`   Tagline: ${details.tagline || 'N/A'}`);
    const avgRuntime = details.episode_run_time && details.episode_run_time.length > 0 ? details.episode_run_time[0] : null;
    console.log(`   Avg Ep Runtime: ${avgRuntime ? `${avgRuntime} min` : 'N/A'}`);
    console.log(`   Seasons: ${details.number_of_seasons || 'N/A'}`);
    console.log(`   Rating: ⭐ ${details.vote_average?.toFixed(1)}/10 (${details.vote_count} votes)`);
    console.log(`   Genres: ${details.genres?.map(g => g.name).join(', ') || 'N/A'}`);
    console.log(chalk.cyan("\n--- Overview ---"));
    console.log(details.overview || 'N/A');

    // Cast, Providers, Reviews (similar to movieCli.ts)
    if (details.credits?.cast && details.credits.cast.length > 0) { /* ... display cast ... */ }
    if (details["watch/providers"]?.results) { /* ... display providers ... */ }
    if (details.reviews?.results && details.reviews.results.length > 0) { /* ... display reviews ... */ }

    // Seasons and Episodes
    if (details.seasons && details.seasons.length > 0) {
        console.log(chalk.cyan("\n--- Seasons ---"));
        details.seasons.forEach(s => console.log(`  S${s.season_number}: ${s.name} (${s.episode_count} episodes)`));
        const seasonChoiceStr = await ask(chalk.green("View details for season number (or 0 to skip): "));
        const seasonNumber = parseInt(seasonChoiceStr);
        if (seasonNumber > 0 && details.seasons.find(s => s.season_number === seasonNumber)) {
            const seasonDetails = await getTMDBTvShowSeasonDetails(details.id, seasonNumber);
            if (seasonDetails && seasonDetails.episodes) {
                console.log(chalk.yellowBright(`\n--- Season ${seasonNumber}: ${seasonDetails.name} Episodes ---`));
                seasonDetails.episodes.slice(0, 10).forEach(ep => { // Show first 10 episodes
                    console.log(`  E${ep.episode_number}: ${ep.name} (Rating: ${ep.vote_average.toFixed(1)})`);
                    // console.log(chalk.dim(`    ${ep.overview?.substring(0,100)}...`));
                });
                 if(seasonDetails.episodes.length > 10) console.log(chalk.dim("    ...and more."));
            }
        }
    }
    console.log(chalk.magenta("----------------------------------------"));
}

async function searchAndSelectTvShow(): Promise<TMDBTvShowFromService | null> {
    const query = await ask(chalk.green("Search for a TV show: "));
    if (!query.trim()) return null;
    const searchResults = await searchTMDBTvShows(query);
    if (!searchResults || searchResults.results.length === 0) {
        console.log(chalk.yellow("No TV shows found."));
        return null;
    }
    console.log(chalk.cyan("\nSearch Results:"));
    searchResults.results.slice(0, 10).forEach((show, index) => {
        console.log(`${index + 1}. ${show.name} (${show.first_air_date?.substring(0,4) || 'N/A'})`);
    });
    const choice = await ask(chalk.green("Select a TV show by number (0 to cancel): "));
    const showIndex = parseInt(choice) - 1;
    if (isNaN(showIndex) || showIndex < 0 || showIndex >= Math.min(10, searchResults.results.length)) {
        return null;
    }
    return searchResults.results[showIndex] ?? null;
}

async function manageTvShowPreferences(userId: number, currentPrefs?: UserTvShowPreferences): Promise<UserTvShowPreferences> {
    console.log(chalk.cyan("\n--- Manage TV Show Preferences ---"));
    let prefs: UserTvShowPreferences = currentPrefs || { user_id: userId };

    const allGenres = await getTvShowGenreList();
    console.log(chalk.dim("Available TV genres: " + allGenres.map(g => g.name).join(', ')));
    const genresStr = await ask(chalk.green(`Preferred Genres (comma-sep, current: ${prefs.preferred_genres?.join(', ') || 'Any'}): `));
    prefs.preferred_genres = genresStr.trim() ? genresStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    const langsStr = await ask(chalk.green(`Preferred Languages (e.g., en,es,fr, current: ${prefs.preferred_languages?.join(', ') || 'Any'}): `));
    prefs.preferred_languages = langsStr.trim() ? langsStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : undefined;

    const yearMinStr = await ask(chalk.green(`Min First Air Year (current: ${prefs.first_air_year_min ?? 'Any'}): `));
    prefs.first_air_year_min = yearMinStr.trim() ? parseInt(yearMinStr) : undefined;
    if (isNaN(prefs.first_air_year_min!)) prefs.first_air_year_min = undefined;

    const yearMaxStr = await ask(chalk.green(`Max First Air Year (current: ${prefs.first_air_year_max ?? 'Any'}): `));
    prefs.first_air_year_max = yearMaxStr.trim() ? parseInt(yearMaxStr) : undefined;
    if (isNaN(prefs.first_air_year_max!)) prefs.first_air_year_max = undefined;

    const epDurMinStr = await ask(chalk.green(`Min Avg Ep Duration (min, current: ${prefs.avg_episode_duration_min ?? 'Any'}): `));
    prefs.avg_episode_duration_min = epDurMinStr.trim() ? parseInt(epDurMinStr) : undefined;
    if (isNaN(prefs.avg_episode_duration_min!)) prefs.avg_episode_duration_min = undefined;

    const epDurMaxStr = await ask(chalk.green(`Max Avg Ep Duration (min, current: ${prefs.avg_episode_duration_max ?? 'Any'}): `));
    prefs.avg_episode_duration_max = epDurMaxStr.trim() ? parseInt(epDurMaxStr) : undefined;
    if (isNaN(prefs.avg_episode_duration_max!)) prefs.avg_episode_duration_max = undefined;
    
    const tmdbRatingStr = await ask(chalk.green(`Min TMDB Rating (0-10, current: ${prefs.min_imdb_rating ?? 'Any'}): `));
    prefs.min_imdb_rating = tmdbRatingStr.trim() ? parseFloat(tmdbRatingStr) : undefined;
    if (isNaN(prefs.min_imdb_rating!)) prefs.min_imdb_rating = undefined;

    const providersStr = await ask(chalk.green(`Preferred Streaming Providers (comma-sep, current: ${prefs.preferred_streaming_providers?.join(', ') || 'Any'}): `));
    prefs.preferred_streaming_providers = providersStr.trim() ? providersStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    await saveUserTvShowPreferences(prefs);
    console.log(chalk.green("TV Show preferences updated!"));
    return prefs;
}

export async function runTvShowCLI(currentUser: User): Promise<void> {
    let userTvShowPrefs = await getUserTvShowPreferences(currentUser.id);
    if (!userTvShowPrefs) {
        console.log(chalk.yellow("No TV show preferences set. Using defaults. Set in option 4."));
        userTvShowPrefs = { user_id: currentUser.id };
    }

    let exitTvMenu = false;
    while (!exitTvMenu) {
        console.log(chalk.bold.blue("\n--- TV Show Recommender Menu ---"));
        console.log("1. Get TV Show Recommendations");
        console.log("2. Rate a TV Show");
        console.log("3. Search and View TV Show Details");
        console.log("4. Manage My TV Show Preferences");
        console.log("0. Back to Main Menu");
        const choice = await ask(chalk.green("Choose an option: "));

        switch (choice) {
            case '1': {
                console.log(chalk.cyan("\nFetching TV show recommendations..."));
                 if (!userTvShowPrefs || Object.values(userTvShowPrefs).filter(v => v !== undefined && v !== null).length <= 1) {
                    console.log(chalk.yellow("TV show preferences are general/not set. Set in Option 4 for better results."));
                }
                const ratedTvShowOurDbIds = await getRatedTvShowIdsByUser(currentUser.id);
                const ratedTvShowsInDb = (await Promise.all(ratedTvShowOurDbIds.map(id => getTvShowByOurId(id)))).filter(s => s) as TvShow[];
                const excludeTmdbIds = new Set(ratedTvShowsInDb.map(s => s.tmdb_id));

                const recommendations = await getTvShowRecommendationsForUser(currentUser, userTvShowPrefs, excludeTmdbIds);
                if (recommendations.length === 0) {
                    console.log(chalk.yellow("No TV show recommendations. Try rating shows or adjusting preferences."));
                } else {
                    console.log(chalk.bold.yellowBright("\nTop TV Show Recommendations for You:"));
                    recommendations.forEach(show => displayTvShowSummary(show, show.id));
                }
                break;
            }
            case '2': {
                const tmdbShowFromSearch = await searchAndSelectTvShow();
                if (tmdbShowFromSearch) {
                    const detailedShowData = await getTMDBTvShowDetails(tmdbShowFromSearch.id);
                    if (!detailedShowData) { console.log(chalk.red("Could not fetch full details.")); break; }
                    const showInDb = await saveTvShow(detailedShowData);
                    if (!showInDb) { console.log(chalk.red("Error saving show. Cannot rate.")); break; }
                    
                    displayTvShowSummary(showInDb, showInDb.id);
                    const ratingStr = await ask(chalk.green(`Rate "${showInDb.name}" (1-5, or 0 to skip): `));
                    const rating = parseInt(ratingStr);
                    if (rating >= 1 && rating <= 5) {
                        await saveUserTvShowRating(currentUser.id, showInDb.id, rating);
                        console.log(chalk.green(`Rated "${showInDb.name}" ${rating} stars.`));
                    }
                }
                break;
            }
            case '3': {
                const tmdbShowFromSearch = await searchAndSelectTvShow();
                if(tmdbShowFromSearch) {
                    await viewTvShowDetailsFlow(tmdbShowFromSearch.id);
                }
                break;
            }
            case '4': {
                userTvShowPrefs = await manageTvShowPreferences(currentUser.id, userTvShowPrefs);
                break;
            }
            case '0':
                exitTvMenu = true;
                break;
            default: console.log(chalk.red("Invalid option."));
        }
    }
}