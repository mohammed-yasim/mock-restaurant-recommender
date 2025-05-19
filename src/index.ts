// src/index.ts
import { initDB, seedInitialData, fetchAndSaveRestaurants, getDB, getAllRestaurants } from './database';
import { runCLI } from './cli';
import chalk from 'chalk';
import readline from 'readline';

function askInitialLocation(query: string): Promise<string> {
  const rlPrompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rlPrompt.question(query, answer => {
    rlPrompt.close();
    resolve(answer);
  }));
}

async function main() {
  console.log(chalk.bold.cyan("🚀 Starting Simple Restaurant Recommender 🚀"));

  const db = await initDB();
  console.log(chalk.green("Database connection established."));

  await seedInitialData(); // Seeds users

  // Check if there are any restaurants. If not, prompt to fetch.
  const currentRestaurants = await getAllRestaurants(); // Use the existing function
  if (currentRestaurants.length === 0) {
    console.log(chalk.yellow("Restaurant database is empty."));
    
    if (!process.env.GOOGLE_PLACES_API_KEY) {
        console.log(chalk.red.bold("Error: GOOGLE_PLACES_API_KEY is not set in your .env file."));
        console.log(chalk.yellow("Cannot fetch restaurants from Google. The application might not have any restaurant data."));
        console.log(chalk.cyan("Please create a .env file with your GOOGLE_PLACES_API_KEY."));
    } else {
        const location = await askInitialLocation(
            chalk.cyan("Enter a city or area to search for restaurants (e.g., 'London', 'restaurants near me in Paris'): ")
        );
        if (location && location.trim()) {
            await fetchAndSaveRestaurants(location.trim());
        } else {
            console.log(chalk.yellow("No location entered. Skipping initial restaurant fetch."));
        }
    }
  } else {
    console.log(chalk.blue(`${currentRestaurants.length} restaurants already in DB. Skipping initial API fetch.`));
  }
  
  await runCLI();

  await db.close();
  console.log(chalk.bold.cyan("Recommender shut down gracefully."));
}

main().catch(async (err) => { // Make catch async to await db.close()
  console.error(chalk.red.bold("Unhandled error in main application:"), err);
  try {
    const dbInstance = await getDB(); // Attempt to get DB instance
    if (dbInstance) {
      await dbInstance.close();
      console.log("Database connection closed on error.");
    }
  } catch (closeErr) {
    console.error("Error closing DB on unhandled main error:", closeErr);
  }
  process.exit(1);
});