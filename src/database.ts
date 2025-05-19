// src/database.ts
import { Database } from 'sqlite';
import { open } from 'sqlite';
import type { User, Restaurant } from './types'; // Keep UserPreferences if used
import { mockUsers } from './data/mockUsers';
import chalk from 'chalk'; // Assuming you use chalk here too

// Import the new service
import { fetchRestaurantsFromGooglePlaces } from './googleApiService';
// Remove: import { fetchRestaurantsFromGoogleAPI } from './googleApiMock';


const DB_PATH = './restaurants.sqlite';
let db: Database;

export async function initDB(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: DB_PATH,
    driver: require('sqlite3').Database // Bun needs this for sqlite3
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      favoriteCuisines TEXT, -- JSON string array
      dietaryRestrictions TEXT, -- JSON string array
      minRating REAL
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      googlePlaceId TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      cuisines TEXT, -- JSON string array
      dietaryOptions TEXT, -- JSON string array
      rating REAL
    );
  `);
  console.log("Database initialized and tables created/verified.");
  return db;
}

export async function seedInitialData(): Promise<void> {
  const db = await initDB();

  // Seed users if table is empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count === 0) {
    console.log("Seeding mock users...");
    const stmt = await db.prepare(
      'INSERT INTO users (name, favoriteCuisines, dietaryRestrictions, minRating) VALUES (?, ?, ?, ?)'
    );
    for (const user of mockUsers) {
      await stmt.run(
        user.name,
        JSON.stringify(user.preferences.favoriteCuisines),
        JSON.stringify(user.preferences.dietaryRestrictions),
        user.preferences.minRating
      );
    }
    await stmt.finalize();
    console.log(`${mockUsers.length} users seeded.`);
  }

  // Restaurants will be seeded by fetching from the "API"
}

export async function saveRestaurant(restaurant: Omit<Restaurant, 'id'>): Promise<number | undefined> {
  const db = await initDB(); // Ensure db is initialized
  try {
    // Check if restaurant with this googlePlaceId already exists to provide better logging
    const existing = await db.get('SELECT id FROM restaurants WHERE googlePlaceId = ?', restaurant.googlePlaceId);
    if (existing) {
      // console.log(`Restaurant "${restaurant.name}" (${restaurant.googlePlaceId}) already exists. Skipping.`);
      return undefined; // Indicate skipped
    }

    const result = await db.run(
      `INSERT INTO restaurants (googlePlaceId, name, address, cuisines, dietaryOptions, rating)
       VALUES (?, ?, ?, ?, ?, ?)`, // Removed ON CONFLICT as we check manually
      restaurant.googlePlaceId,
      restaurant.name,
      restaurant.address,
      JSON.stringify(restaurant.cuisines),
      JSON.stringify(restaurant.dietaryOptions),
      restaurant.rating
    );
    return result.lastID;
  } catch (error) {
    // If error is due to UNIQUE constraint (race condition if not checking first), it will be caught
    if ((error as any).message && (error as any).message.includes('UNIQUE constraint failed: restaurants.googlePlaceId')) {
        // console.warn(`Conflict saving restaurant "${restaurant.name}", likely already exists (race condition).`);
        return undefined; // Treat as skipped
    }
    console.error(chalk.red(`Error saving restaurant "${restaurant.name}":`), error);
    return undefined;
  }
}

export async function getAllUsers(): Promise<User[]> {
  const db = await initDB();
  const rows = await db.all('SELECT * FROM users');
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    preferences: {
      favoriteCuisines: JSON.parse(row.favoriteCuisines),
      dietaryRestrictions: JSON.parse(row.dietaryRestrictions),
      minRating: row.minRating,
    },
  }));
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await initDB();
  const row = await db.get('SELECT * FROM users WHERE id = ?', id);
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    preferences: {
      favoriteCuisines: JSON.parse(row.favoriteCuisines),
      dietaryRestrictions: JSON.parse(row.dietaryRestrictions),
      minRating: row.minRating,
    },
  };
}

export async function getAllRestaurants(): Promise<Restaurant[]> {
  const db = await initDB();
  const rows = await db.all('SELECT * FROM restaurants');
  return rows.map(row => ({
    id: row.id,
    googlePlaceId: row.googlePlaceId,
    name: row.name,
    address: row.address,
    cuisines: JSON.parse(row.cuisines),
    dietaryOptions: JSON.parse(row.dietaryOptions),
    rating: row.rating,
  }));
}

export async function getDB(): Promise<Database> {
    return initDB();
}

export async function fetchAndSaveRestaurants(locationQuery: string): Promise<void> {
  if (!locationQuery || locationQuery.trim() === "") {
    console.log(chalk.yellow("Location query is empty. Skipping fetch from Google Places API."));
    return;
  }
  
  console.log(chalk.blue(`Attempting to fetch restaurants from Google Places API for: "${locationQuery}"`));
  // Use the new service directly
  const restaurantsFromApi = await fetchRestaurantsFromGooglePlaces(locationQuery);

  if (!restaurantsFromApi || restaurantsFromApi.length === 0) {
    console.log(chalk.yellow("No restaurants returned from Google Places API or an error occurred. Database will not be updated with new entries from this fetch."));
    return;
  }

  console.log(`Fetched ${restaurantsFromApi.length} potential restaurants from Google Places API.`);
  let savedCount = 0;
  let existingSkippedCount = 0;

  for (const resto of restaurantsFromApi) {
    // Check if restaurant with this googlePlaceId already exists
    const existing = await db.get('SELECT id FROM restaurants WHERE googlePlaceId = ?', resto.googlePlaceId);
    if (existing) {
      existingSkippedCount++;
      continue; // Skip if already exists
    }

    const result = await db.run(
      `INSERT INTO restaurants (googlePlaceId, name, address, cuisines, dietaryOptions, rating)
       VALUES (?, ?, ?, ?, ?, ?)`,
      resto.googlePlaceId,
      resto.name,
      resto.address,
      JSON.stringify(resto.cuisines),
      JSON.stringify(resto.dietaryOptions),
      resto.rating
    );
    if (result.lastID) {
      savedCount++;
    }
  }
  console.log(chalk.green(`Saved ${savedCount} new restaurants to the database.`));
  if (existingSkippedCount > 0) {
      console.log(chalk.blue(`Skipped ${existingSkippedCount} restaurants that already exist in the database.`));
  }
  if (savedCount === 0 && existingSkippedCount === restaurantsFromApi.length && restaurantsFromApi.length > 0) {
      console.log(chalk.blue("All fetched restaurants already existed in the database."));
  } else if (savedCount === 0 && restaurantsFromApi.length > 0) {
      console.log(chalk.yellow("No new restaurants were saved. This might be due to all fetched items already existing or issues during saving."));
  }
}