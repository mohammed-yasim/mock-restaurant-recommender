// src/cli/restaurantCli.ts
import readline from 'readline';
import chalk from 'chalk';
import type { User } from '../common/types';
import type { Restaurant, RestaurantUserPreferences } from '../restaurants/types';
import {
    getAllRestaurantsFromDb,
    getUserRestaurantPreferences,
    saveUserRestaurantPreferences,
    recordUserRestaurantLike,
    getLikedRestaurantIdsByUserId,
    fetchAndSaveRestaurantsToDb,
    seedInitialRestaurantPreferences // For initial setup if needed
} from '../db/restaurantDb';
import { getRestaurantRecommendations } from '../restaurants/recommender';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

function displayRestaurantDetails(restaurant: Restaurant): void {
    console.log(chalk.magenta("\n----------------------------------------"));
    console.log(chalk.bold.yellowBright(` ✨ How about: ${restaurant.name}? ✨`));
    console.log(chalk.gray(`      Address: ${restaurant.address}`));
    console.log(`      Cuisines: ${restaurant.cuisines.join(', ')}`);
    console.log(`      Rating: ${'⭐'.repeat(Math.round(restaurant.rating))}(${restaurant.rating.toFixed(1)})`);
    if (restaurant.dietaryOptions.length > 0) {
        console.log(`      Dietary: ${restaurant.dietaryOptions.join(', ')}`);
    }
    console.log(chalk.magenta("----------------------------------------"));
}

async function manageRestaurantPreferences(currentUser: User, prefs: RestaurantUserPreferences | undefined): Promise<RestaurantUserPreferences> {
    console.log(chalk.cyan("\n--- Manage Restaurant Preferences ---"));
    let currentPrefs = prefs || {
        user_id: currentUser.id,
        favoriteCuisines: [],
        dietaryRestrictions: [],
        minRating: 3.0
    };

    const cuisinesStr = await ask(chalk.green(`Favorite cuisines (comma-separated, current: ${currentPrefs.favoriteCuisines.join(', ') || 'Any'}): `));
    if (cuisinesStr.trim()) currentPrefs.favoriteCuisines = cuisinesStr.split(',').map(c => c.trim()).filter(c => c);

    const dietStr = await ask(chalk.green(`Dietary restrictions (comma-separated, current: ${currentPrefs.dietaryRestrictions.join(', ') || 'None'}): `));
    if (dietStr.trim()) currentPrefs.dietaryRestrictions = dietStr.split(',').map(d => d.trim()).filter(d => d);
    
    const ratingStr = await ask(chalk.green(`Minimum rating (1-5, current: ${currentPrefs.minRating}): `));
    const newMinRating = parseFloat(ratingStr);
    if (!isNaN(newMinRating) && newMinRating >=1 && newMinRating <=5) currentPrefs.minRating = newMinRating;

    await saveUserRestaurantPreferences(currentPrefs);
    console.log(chalk.green("Preferences updated!"));
    return currentPrefs;
}


export async function runRestaurantCLI(currentUser: User): Promise<void> {
    console.log(chalk.bold.blue("\n--- Restaurant Recommender ---"));

    let userPrefs = await getUserRestaurantPreferences(currentUser.id);
    if (!userPrefs) {
        console.log(chalk.yellow("No specific restaurant preferences found. Let's set some up or use defaults."));
        // Provide default preferences or prompt to create them.
        // For now, let's offer to set them or use a very basic default.
        const setupChoice = await ask(chalk.green("Set up your restaurant preferences now? (y/n): "));
        if(setupChoice.toLowerCase() === 'y') {
            userPrefs = await manageRestaurantPreferences(currentUser, undefined);
        } else {
            userPrefs = {
                user_id: currentUser.id,
                favoriteCuisines: ["Any"],
                dietaryRestrictions: [],
                minRating: 3.0
            };
            await saveUserRestaurantPreferences(userPrefs); // Save default
            console.log(chalk.blue("Using default preferences. You can change them later."));
        }
    }

    let exitRestaurantMenu = false;
    while (!exitRestaurantMenu && userPrefs) {
        console.log(chalk.cyan("\nRestaurant Menu:"));
        console.log("1. Get Recommendations");
        console.log("2. Fetch New Restaurants (by location)");
        console.log("3. Manage My Preferences");
        console.log("0. Back to Main Menu");
        const choice = await ask(chalk.green("Choose an option: "));

        switch (choice) {
            case '1': {
                const allDbRestaurants = await getAllRestaurantsFromDb();
                if (allDbRestaurants.length === 0) {
                    console.log(chalk.yellow("No restaurants in DB. Try fetching some first (option 2)."));
                    break;
                }

                const likedRestaurantIds = await getLikedRestaurantIdsByUserId(currentUser.id);
                let shownAndLikedIds = new Set<number>(likedRestaurantIds);

                let recommendations = await getRestaurantRecommendations(currentUser, userPrefs, allDbRestaurants, shownAndLikedIds);

                if (recommendations.length === 0) {
                    console.log(chalk.yellow("\nNo restaurants match your current preferences and haven't been liked/shown."));
                    break;
                }

                while(recommendations.length > 0) {
                    const nextRestaurant = recommendations.shift();
                    if (!nextRestaurant || !nextRestaurant.id) continue;

                    displayRestaurantDetails(nextRestaurant);
                    shownAndLikedIds.add(nextRestaurant.id);

                    const action = (await ask(chalk.cyan("Like it? (y/n, 's' to stop for now): "))).toLowerCase();
                    if (action === 'y') {
                        console.log(chalk.green(`You liked ${nextRestaurant.name}!`));
                        await recordUserRestaurantLike(currentUser.id, nextRestaurant.id);
                    } else if (action === 's') {
                        break; // Stop showing more recommendations for now
                    }
                    // For 'n', we just move to the next one based on current `shownAndLikedIds`

                    if (recommendations.length === 0) { // If initial list exhausted, try to get more
                        recommendations = await getRestaurantRecommendations(currentUser, userPrefs, allDbRestaurants, shownAndLikedIds);
                    }
                    if (recommendations.length === 0) {
                        console.log(chalk.yellow("\nNo more matching restaurants to show based on your preferences and interactions."));
                        break;
                    }
                }
                break;
            }
            case '2': {
                const location = await ask(chalk.green("Enter city/area to search for restaurants: "));
                if (location.trim()) {
                    await fetchAndSaveRestaurantsToDb(location.trim());
                } else {
                    console.log(chalk.yellow("No location entered."));
                }
                break;
            }
            case '3': {
                userPrefs = await manageRestaurantPreferences(currentUser, userPrefs);
                break;
            }
            case '0':
                exitRestaurantMenu = true;
                break;
            default:
                console.log(chalk.red("Invalid option."));
        }
    }
}