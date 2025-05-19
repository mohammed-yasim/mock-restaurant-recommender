// src/cli.ts
import readline from 'readline';
import chalk from 'chalk';
import type { User, Restaurant } from './types';
import { getAllUsers, getUserById, getAllRestaurants as dbGetAllRestaurants } from './database';
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

    let shownRestaurantIds = new Set<number>();
    let potentialRecommendations = await getRecommendations(currentUser, allDbRestaurants, shownRestaurantIds);

    while (potentialRecommendations.length > 0) {
      const nextRestaurant = potentialRecommendations.shift(); // Get the top one
      if (!nextRestaurant || !nextRestaurant.id) continue; // Should not happen if filtered correctly

      displayRestaurant(nextRestaurant);
      shownRestaurantIds.add(nextRestaurant.id);

      const action = (await askQuestion(chalk.cyan("Like it? (y/n, or 'q' to change user, 'Q' to quit app): "))).toLowerCase();

      if (action === 'q') {
        break; // Break inner loop to re-select user
      }
      if (action === 'Q') {
        rl.close();
        return; // Exit CLI
      }
      
      // If 'y' or 'n', we just proceed to the next recommendation from the current sorted list.
      // More advanced: if 'n', re-calculate recommendations penalizing features of the disliked one.
      // For now, simply excluding already shown ones is sufficient for basic Y/N flow.
      
      if (potentialRecommendations.length === 0) {
         potentialRecommendations = await getRecommendations(currentUser, allDbRestaurants, shownRestaurantIds);
         if(potentialRecommendations.length === 0) {
            console.log(chalk.yellow("\nNo more matching restaurants based on your preferences and interactions."));
            break;
         }
      }
    }
    if (potentialRecommendations.length === 0 && currentUser) {
        console.log(chalk.yellow(`\nAll suitable recommendations shown for ${currentUser.name} based on current criteria.`));
    }
  }
  console.log(chalk.bold.green("\nExiting Recommender. Goodbye!"));
  rl.close();
}