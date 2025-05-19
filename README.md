# Simple Restaurant Recommender

This project is a simple command-line restaurant recommender application built with Bun and TypeScript. It allows users to get restaurant recommendations based on their preferences.

## Features

* **User Profiles:** Stores user preferences for cuisines, dietary restrictions, and minimum ratings.
* **Restaurant Data:** Fetches restaurant data from the Google Places API (requires API key).
* **Recommendation Engine:** Provides restaurant suggestions based on user preferences.
* **Interactive CLI:** Allows users to select a profile and browse recommendations.

## Project Structure

```
.
├── bun.lockb
├── package.json
├── README.md
├── restaurants.sqlite
├── tsconfig.json
└── src
    ├── cli.ts                # Command-line interface logic
    ├── data
    │   └── mockUsers.ts      # Mock user data for seeding
    ├── database.ts           # Database initialization, seeding, and queries
    ├── googleApiService.ts   # Service for interacting with Google Places API
    ├── index.ts              # Main application entry point
    ├── recommender.ts        # Recommendation logic
    └── types.ts              # TypeScript type definitions
```

## Prerequisites

* [Bun](https://bun.sh/)
* Node.js (for some Bun features or if you prefer npm/yarn for certain tasks)
* A Google Places API Key (for fetching restaurant data)

## Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd mock
   ```
2. **Install dependencies:**

   ```bash
   bun install
   ```
3. **Set up environment variables:**
   Create a `.env` file in the root of the project and add your Google Places API key:

   ```env
   GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
   ```

## Running the Application

* **Start the application:**

  ```bash
  bun start
  ```

  This will initialize the database, seed initial user data, and prompt you to fetch restaurants if the database is empty. Then, it will launch the interactive CLI.
* **Development mode (with hot-reloading):**

  ```bash
  bun run dev
  ```
* **Build the application:**

  ```bash
  bun run build
  ```

  This will create a production build in the `dist` folder.

## How it Works

1. **Initialization (`src/index.ts`):**

   * Connects to the SQLite database (`restaurants.sqlite`).
   * Seeds initial user data from `src/data/mockUsers.ts` if the users table is empty.
   * Checks if there are restaurants in the database.
     * If not, and a `GOOGLE_PLACES_API_KEY` is provided, it prompts the user for a location and fetches restaurant data using the Google Places API (`src/googleApiService.ts`).
     * Fetched data is then saved to the database.
   * Starts the command-line interface (`src/cli.ts`).
2. **Command-Line Interface (`src/cli.ts`):**

   * Prompts the user to select a user profile.
   * Displays the selected user's preferences.
   * Fetches and displays restaurant recommendations based on the user's preferences using the logic in `src/recommender.ts`.
   * Allows the user to indicate if they like a recommendation ("y"), want another one ("n"), want to change users ("q"), or quit the application ("Q").
3. **Recommendation Logic (`src/recommender.ts`):**

   * Filters restaurants based on the user's dietary restrictions and minimum rating.
   * Scores remaining restaurants based on how well their cuisines match the user's favorite cuisines.
   * Sorts restaurants by score (and potentially other factors like rating) to provide the best recommendations first.
   * Keeps track of restaurants already shown to the user to avoid repetition.
4. **Database (`src/database.ts`):**

   * Uses `sqlite` and `sqlite3` for database operations.
   * Manages schema creation, data seeding (users), and CRUD operations for users and restaurants.

## Key Files

* `src/index.ts`: Main entry point, orchestrates application startup.
* `src/cli.ts`: Handles all user interactions via the command line.
* `src/database.ts`: Manages all SQLite database interactions.
* `src/recommender.ts`: Contains the core logic for generating recommendations.
* `src/types.ts`: Defines shared TypeScript interfaces for `User`, `Restaurant`, and `UserPreferences`.
* `src/googleApiService.ts`: Responsible for fetching data from the Google Places API.
* `restaurants.sqlite`: The SQLite database file.
* `package.json`: Defines project metadata, dependencies, and scripts.

## Future Enhancements (Ideas)

* More sophisticated recommendation algorithms (e.g., collaborative filtering if user ratings were collected).
* Ability for users to save favorite restaurants.
* Option to filter by specific dietary options directly (e.g., "vegan options" vs. general "vegan" dietary restriction).
* Location-based searching using latitude/longitude.
* Web interface instead of/in addition to the CLI.
* More robust error handling and input validation.
* Unit and integration tests.
