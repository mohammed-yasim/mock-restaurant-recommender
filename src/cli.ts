// src/cli.ts
import readline from 'readline';
import chalk from 'chalk';
import type { User, Restaurant } from './types';
import { getAllUsers, getUserById, getAllRestaurants as dbGetAllRestaurants, recordUserLike, getLikedRestaurantIdsByUser } from './database';
import { getRecommendations } from './recommender';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function selectUser(): Promise<User | null> {
  const users = await getAllUsers();
  if (users.length === 0) {
    console.log(chalk.yellow("No users found in the database. Please seed users first."));
    return null;
  }

  console.log(chalk.cyan("\nAvailable Users:"));
  users.forEach(user => console.log(`${user.id}. ${user.name}`));
  console.log("0. Exit");

  while (true) {
    const choice = await askQuestion(chalk.green("Select a user by ID (or 0 to exit): "));
    const userId = parseInt(choice, 10);

    if (userId === 0) return null;

    const selectedUser = await getUserById(userId);
    if (selectedUser) {
      console.log(chalk.blue(`\nSelected User: ${selectedUser.name}`));
      console.log(chalk.gray(`Preferences: 
        Cuisines: ${selectedUser.preferences.favoriteCuisines.join(', ') || 'Any'}
        Dietary: ${selectedUser.preferences.dietaryRestrictions.join(', ') || 'None'}
        Min Rating: ${selectedUser.preferences.minRating}`));
      return selectedUser;
    }
    console.log(chalk.red("Invalid user ID. Please try again."));
  }
}

function displayRestaurant(restaurant: Restaurant): void {
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

export async function runCLI() {
  console.log(chalk.bold.green("Restaurant Recommender CLI"));
  
  const allDbRestaurants = await dbGetAllRestaurants();
  if(allDbRestaurants.length === 0) {
    console.log(chalk.yellow("No restaurants in DB. Consider fetching them first (e.g., by running a fetch command or on app start)."));
    // For this demo, let's assume they are already fetched and saved via main index.ts
  }

  while (true) {
    const currentUser = await selectUser();
    if (!currentUser) break;

    // Fetch liked restaurants for the current user at the start of their session
    const initiallyLikedRestaurantIds = await getLikedRestaurantIdsByUser(currentUser.id);
    let shownAndLikedRestaurantIds = new Set<number>(initiallyLikedRestaurantIds); // Combine with session's shown IDs

    let potentialRecommendations = await getRecommendations(currentUser, allDbRestaurants, shownAndLikedRestaurantIds);

    if (potentialRecommendations.length === 0 && initiallyLikedRestaurantIds.length > 0) {
        console.log(chalk.blue(`You've previously liked ${initiallyLikedRestaurantIds.length} restaurant(s). No new recommendations match your preferences at the moment.`));
    } else if (potentialRecommendations.length === 0) {
        console.log(chalk.yellow("\nNo restaurants currently match your preferences."));
    }


    while (potentialRecommendations.length > 0) {
      const nextRestaurant = potentialRecommendations.shift();
      if (!nextRestaurant || !nextRestaurant.id) continue;

      displayRestaurant(nextRestaurant);
      
      // Add to shown set regardless of like/dislike to avoid re-showing in this session
      shownAndLikedRestaurantIds.add(nextRestaurant.id);


      const action = (await askQuestion(chalk.cyan("Like it? (y/n, or 'q' to change user, 'Q' to quit app): "))).toLowerCase();

      if (action === 'y') {
        console.log(chalk.green(`You liked ${nextRestaurant.name}! Saving to your preferences...`));
        await recordUserLike(currentUser.id, nextRestaurant.id); // <--- RECORD THE LIKE
        // No need to add to shownAndLikedRestaurantIds again, it was added above
      } else if (action === 'n') {
        // For 'n', we don't record it as a "dislike" yet, but it's already in shownAndLikedRestaurantIds
        // so it won't be shown again in this session's immediate recommendation list.
      } else if (action === 'q') {
        break;
      } else if (action === 'Q') {
        rl.close();
        return;
      }
      
      // Regenerate recommendations excluding all shown or liked ones for this session
      // This ensures previously liked items (from DB) are also excluded from new suggestions.
      potentialRecommendations = await getRecommendations(currentUser, allDbRestaurants, shownAndLikedRestaurantIds);
      
      if (potentialRecommendations.length === 0) {
        const remainingUnseen = allDbRestaurants.filter(r => r.id && !shownAndLikedRestaurantIds.has(r.id)).length;
        if (remainingUnseen === 0) {
             console.log(chalk.yellow("\nNo more restaurants to show based on your preferences and interactions. You've seen them all!"));
        } else {
             console.log(chalk.yellow("\nNo more matching restaurants based on your preferences and interactions."));
        }
        break;
      }
    }
    if (potentialRecommendations.length === 0 && currentUser) {
        // This message might be redundant given the one inside the loop
        // console.log(chalk.yellow(`\nAll suitable recommendations shown for ${currentUser.name} based on current criteria.`));
    }
  }
  console.log(chalk.bold.green("\nExiting Recommender. Goodbye!"));
  rl.close();
}