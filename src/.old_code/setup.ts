// src/database/setup.ts
import { Database } from 'sqlite';
import { open } from 'sqlite';
import chalk from 'chalk';
import { mockUsers } from '../data/mockUsers'; // Adjust path if mockUsers is moved/common
import type { User } from '../common/types';

const DB_PATH = './recommender.sqlite'; // Single DB for everything
let db: Database;

export async function initDB(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: DB_PATH,
    driver: require('sqlite3').Database
  });

  // User Table (common)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE -- Assuming unique user names for simplicity
      -- Restaurant specific preferences can be moved to a separate table or handled in restaurantDb
      -- For now, let's assume users are generic, and preferences are managed by modules
    );
  `);

  // Restaurant Tables (from previous setup, ensure they are here)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      googlePlaceId TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      cuisines TEXT, -- JSON string array
      dietaryOptions TEXT, -- JSON string array
      rating REAL
    );

    CREATE TABLE IF NOT EXISTS user_restaurant_likes (
      user_id INTEGER NOT NULL,
      restaurant_id INTEGER NOT NULL,
      liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, restaurant_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );
    
    -- Initial user restaurant preferences (example, can be refactored)
    CREATE TABLE IF NOT EXISTS user_restaurant_preferences (
        user_id INTEGER PRIMARY KEY,
        favoriteCuisines TEXT, -- JSON string array
        dietaryRestrictions TEXT, -- JSON string array
        minRating REAL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Movie Tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      overview TEXT,
      release_date TEXT,
      vote_average REAL,
      vote_count INTEGER,
      poster_path TEXT,
      backdrop_path TEXT,
      genres TEXT -- JSON string array of genre names or IDs
    );

    CREATE TABLE IF NOT EXISTS user_movie_ratings (
      user_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL, -- Refers to our DB movie id
      rating INTEGER NOT NULL, -- e.g., 1-5 or 1-10
      rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, movie_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
  `);

  // TV Show Tables (similar to movies)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tv_shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      overview TEXT,
      first_air_date TEXT,
      vote_average REAL,
      vote_count INTEGER,
      poster_path TEXT,
      backdrop_path TEXT,
      genres TEXT, -- JSON string array
      number_of_seasons INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_tv_show_ratings (
      user_id INTEGER NOT NULL,
      tv_show_id INTEGER NOT NULL, -- Refers to our DB tv_show id
      rating INTEGER NOT NULL,
      rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, tv_show_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tv_show_id) REFERENCES tv_shows(id) ON DELETE CASCADE
    );
    
    -- You might add seasons and episodes tables if caching them extensively
    -- CREATE TABLE IF NOT EXISTS tv_seasons (...);
    -- CREATE TABLE IF NOT EXISTS tv_episodes (...);

    
  `);

  // Movie Preferences Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_movie_preferences (
      user_id INTEGER PRIMARY KEY,
      preferred_genres TEXT,        -- JSON array of genre names or IDs
      preferred_languages TEXT,     -- JSON array of language codes (e.g., "en", "es")
      release_year_min INTEGER,
      release_year_max INTEGER,
      duration_min_minutes INTEGER, -- Duration in minutes
      duration_max_minutes INTEGER,
      min_imdb_rating REAL,         -- e.g., 7.5
      preferred_streaming_providers TEXT, -- JSON array of provider names or IDs
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // TV Show Preferences Table (similar structure)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_tv_show_preferences (
      user_id INTEGER PRIMARY KEY,
      preferred_genres TEXT,
      preferred_languages TEXT,
      first_air_year_min INTEGER,
      first_air_year_max INTEGER,
      -- Duration for TV shows is more complex (avg episode duration vs total series)
      -- For simplicity, we might omit or use average episode duration if available
      avg_episode_duration_min INTEGER,
      avg_episode_duration_max INTEGER,
      min_imdb_rating REAL,
      preferred_streaming_providers TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log(chalk.blue("Database initialized with all tables."));
  return db;
}

export async function getDB(): Promise<Database> {
  if (!db) await initDB();
  return db;
}

// Generic user creation/retrieval (can be expanded)
export async function ensureUser(name: string): Promise<User | undefined> {
    const db = await getDB();
    let user = await db.get<User>('SELECT * FROM users WHERE name = ?', name);
    if (!user) {
        const result = await db.run('INSERT INTO users (name) VALUES (?)', name);
        if (result.lastID) {
            user = await db.get<User>('SELECT * FROM users WHERE id = ?', result.lastID);
        }
    }
    return user;
}
export async function getAllUsers(): Promise<User[]> {
    const db = await getDB();
    return db.all<User[]>('SELECT * FROM users');
}
export async function getUserById(id: number): Promise<User | undefined > {
    const db = await getDB();
    return db.get<User>('SELECT * FROM users WHERE id = ?', id);
}


// Seed initial users (generic part)
export async function seedInitialGenericUsers(): Promise<void> {
  const db = await getDB();
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');

  if (userCount && userCount.count === 0) {
    console.log("Seeding generic mock users...");
    const usersToSeed = [
        { name: "Alice" }, { name: "Bob" }, { name: "Charlie" },
        { name: "Diana" }, { name: "Edward"}
    ];
    for (const u of usersToSeed) {
        await db.run('INSERT INTO users (name) VALUES (?)', u.name);
    }
    console.log(`${usersToSeed.length} generic users seeded.`);
    // Note: Restaurant-specific preferences seeding should be handled by restaurant module
  }
}