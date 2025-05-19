// src/types.ts
export interface UserPreferences {
  favoriteCuisines: string[];
  dietaryRestrictions: string[]; // e.g., "vegetarian", "gluten-free", "vegan"
  minRating: number; // 1-5
}

export interface User {
  id: number;
  name: string;
  preferences: UserPreferences;
}

export interface Restaurant {
  id?: number; // Optional because DB will assign it
  googlePlaceId: string; // To simulate a unique ID from Google
  name: string;
  address: string; // Simplified location
  cuisines: string[]; // e.g., ["Italian", "Pizza"]
  dietaryOptions: string[]; // e.g., ["vegetarian", "vegan options"]
  rating: number; // 1-5
  // Potentially add lat/lng if doing real location-based filtering
}