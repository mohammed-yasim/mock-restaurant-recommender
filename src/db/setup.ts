import { Database } from 'sqlite';
import { open } from 'sqlite';
import chalk from 'chalk';
// Note: Mock user data is now more specific to modules (e.g., restaurant preferences)
// and generic user seeding is handled here.

const DB_PATH = './recommender_system.sqlite'; // A more descriptive name for the single DB
let db: Database;

export async function initDB(): Promise<Database> {
  if (db) {
    // console.log(chalk.dim("Database connection already established."));
    return db;
  }

  console.log(chalk.blue("Initializing database connection..."));
  db = await open({
    filename: DB_PATH,
    driver: require('sqlite3').Database // Bun needs this for sqlite3 driver
  });

  // Enable Foreign Key support if not enabled by default (good practice)
  await db.exec('PRAGMA foreign_keys = ON;');

  // --- User Table (Common for all modules) ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE -- Ensure user names are unique
    );
  `);
  console.log(chalk.green("Table 'users' ensured."));

  // --- Restaurant Module Tables ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      googlePlaceId TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      cuisines TEXT,          -- JSON string array of cuisine names
      dietaryOptions TEXT,    -- JSON string array of dietary option names
      rating REAL
    );
  `);
  console.log(chalk.green("Table 'restaurants' ensured."));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_restaurant_preferences (
        user_id INTEGER PRIMARY KEY,
        favoriteCuisines TEXT,    -- JSON string array
        dietaryRestrictions TEXT, -- JSON string array
        minRating REAL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log(chalk.green("Table 'user_restaurant_preferences' ensured."));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_restaurant_likes (
      user_id INTEGER NOT NULL,
      restaurant_id INTEGER NOT NULL,
      liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, restaurant_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );
  `);
  console.log(chalk.green("Table 'user_restaurant_likes' ensured."));

  // --- Movie Module Tables ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      overview TEXT,
      release_date TEXT,          -- Format: "YYYY-MM-DD" or NULL
      vote_average REAL,          -- TMDB's rating (0-10)
      vote_count INTEGER,
      poster_path TEXT,
      backdrop_path TEXT,
      genres TEXT,                -- JSON string array of {id, name} genre objects
      runtime INTEGER,            -- Duration in minutes or NULL
      original_language TEXT,     -- ISO 639-1 code or NULL
      imdb_id TEXT                -- IMDb ID (e.g., "tt1234567") or NULL
    );
  `);
  console.log(chalk.green("Table 'movies' ensured."));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_movie_preferences (
      user_id INTEGER PRIMARY KEY,
      preferred_genres TEXT,          -- JSON array of genre names
      preferred_languages TEXT,       -- JSON array of language codes (e.g., "en", "es")
      release_year_min INTEGER,       -- NULL if not set
      release_year_max INTEGER,       -- NULL if not set
      duration_min_minutes INTEGER,   -- NULL if not set
      duration_max_minutes INTEGER,   -- NULL if not set
      min_imdb_rating REAL,           -- Using TMDB vote_average as proxy; NULL if not set
      preferred_streaming_providers TEXT, -- JSON array of provider names or IDs; NULL if not set
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log(chalk.green("Table 'user_movie_preferences' ensured."));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_movie_ratings (
      user_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,        -- Refers to our internal movies.id
      rating INTEGER NOT NULL,          -- User's rating (e.g., 1-5)
      rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, movie_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
  `);
  console.log(chalk.green("Table 'user_movie_ratings' ensured."));

  // --- TV Show Module Tables ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tv_shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      overview TEXT,
      first_air_date TEXT,        -- Format: "YYYY-MM-DD" or NULL
      vote_average REAL,
      vote_count INTEGER,
      poster_path TEXT,
      backdrop_path TEXT,
      genres TEXT,                -- JSON string array of {id, name} genre objects
      number_of_seasons INTEGER,  -- NULL if not set
      episode_run_time TEXT,      -- JSON array of runtimes (e.g. [22, 25]) or NULL
      original_language TEXT,     -- ISO 639-1 code or NULL
      imdb_id TEXT                -- IMDb ID or NULL
    );
  `);
  console.log(chalk.green("Table 'tv_shows' ensured."));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_tv_show_preferences (
      user_id INTEGER PRIMARY KEY,
      preferred_genres TEXT,
      preferred_languages TEXT,
      first_air_year_min INTEGER,
      first_air_year_max INTEGER,
      avg_episode_duration_min INTEGER, -- Using first element of episode_run_time as proxy
      avg_episode_duration_max INTEGER,
      min_imdb_rating REAL,             -- Using TMDB vote_average as proxy
      preferred_streaming_providers TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log(chalk.green("Table 'user_tv_show_preferences' ensured."));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_tv_show_ratings (
      user_id INTEGER NOT NULL,
      tv_show_id INTEGER NOT NULL,      -- Refers to our internal tv_shows.id
      rating INTEGER NOT NULL,
      rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, tv_show_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tv_show_id) REFERENCES tv_shows(id) ON DELETE CASCADE
    );
  `);
  console.log(chalk.green("Table 'user_tv_show_ratings' ensured."));

  console.log(chalk.blueBright("\nDatabase schema initialized/verified successfully!"));
  return db;
}

// Getter for the database instance
export async function getDB(): Promise<Database> {
  if (!db) {
    // This case should ideally not be hit if initDB is called first in index.ts
    // But as a fallback, initialize it.
    console.warn(chalk.yellow("DB instance not found, initializing it now. Ensure initDB() is called at app start."));
    await initDB();
  }
  return db;
}

// --- Generic User Management ---
// Common User type (can also live in src/common/types.ts and be imported)
export interface User {
  id: number;
  name: string;
}

/**
 * Ensures a user with the given name exists. If not, creates them.
 * Returns the user object (existing or newly created).
 */
export async function ensureUser(name: string): Promise<User | undefined> {
    const currentDb = await getDB(); // Use getDB to ensure db is initialized
    try {
        let user = await currentDb.get<User>('SELECT id, name FROM users WHERE name = ?', name);
        if (!user) {
            const result = await currentDb.run('INSERT INTO users (name) VALUES (?)', name);
            if (result.lastID) {
                user = await currentDb.get<User>('SELECT id, name FROM users WHERE id = ?', result.lastID);
                // console.log(chalk.dim(`[DB] Created new user: ${name} (ID: ${result.lastID})`));
            }
        } else {
            // console.log(chalk.dim(`[DB] Found existing user: ${name} (ID: ${user.id})`));
        }
        return user;
    } catch (error: any) {
        // Specifically handle UNIQUE constraint error for name, though ensureUser should find it first
        if (error.message?.includes('UNIQUE constraint failed: users.name')) {
            // console.warn(chalk.yellow(`[DB] User "${name}" likely already exists (constraint violation). Attempting to fetch.`));
            return currentDb.get<User>('SELECT id, name FROM users WHERE name = ?', name);
        }
        console.error(chalk.red(`[DB Error] Error ensuring user "${name}":`), error);
        return undefined;
    }
}

export async function getAllUsers(): Promise<User[]> {
    const currentDb = await getDB();
    return currentDb.all<User[]>('SELECT id, name FROM users ORDER BY name ASC');
}

export async function getUserById(id: number): Promise<User | undefined > {
    const currentDb = await getDB();
    return currentDb.get<User>('SELECT id, name FROM users WHERE id = ?', id);
}

// Seed initial generic users (if users table is empty)
export async function seedInitialGenericUsers(): Promise<void> {
  const currentDb = await getDB();
  const userCountResult = await currentDb.get<{ count: number }>('SELECT COUNT(*) as count FROM users');

  if (userCountResult && userCountResult.count === 0) {
    console.log(chalk.magenta("Seeding initial generic users..."));
    const usersToSeed = [
        { name: "Alice" }, { name: "Bob" }, { name: "Charlie" },
        { name: "Diana" }, { name: "Edward"}, { name: "Fiona" } // Added Fiona
    ];
    let seededCount = 0;
    for (const u of usersToSeed) {
        // Use ensureUser to avoid issues if somehow one was created in a race (unlikely for CLI)
        const user = await ensureUser(u.name);
        if (user) seededCount++;
    }
    if (seededCount > 0) {
        console.log(chalk.magenta(`${seededCount} generic users seeded.`));
    } else {
        console.log(chalk.yellow("No generic users needed to be seeded or seeding failed."));
    }
  } else {
    // console.log(chalk.dim("Generic users table already populated or check failed. Skipping seed."));
  }
}