// src/data/mockUsers.ts
import type { User } from '../types';

export const mockUsers: Omit<User, 'id'>[] = [
  {
    name: "Alice",
    preferences: {
      favoriteCuisines: ["Italian", "Mexican"],
      dietaryRestrictions: [],
      minRating: 4.0,
    },
  },
  {
    name: "Bob",
    preferences: {
      favoriteCuisines: ["Indian", "Thai", "Vietnamese"],
      dietaryRestrictions: ["vegetarian"],
      minRating: 4.2,
    },
  },
  {
    name: "Charlie",
    preferences: {
      favoriteCuisines: ["American", "BBQ"],
      dietaryRestrictions: [],
      minRating: 3.5,
    },
  },
  {
    name: "Diana",
    preferences: {
      favoriteCuisines: ["Japanese", "Sushi", "Ramen"],
      dietaryRestrictions: ["gluten-free"],
      minRating: 4.5,
    },
  },
  {
    name: "Edward",
    preferences: {
      favoriteCuisines: ["Mediterranean", "Greek", "Cafe"],
      dietaryRestrictions: ["vegan"],
      minRating: 3.8,
    },
  },
  {
    name: "Fiona",
    preferences: {
      favoriteCuisines: ["Any"], // Special case for "any cuisine"
      dietaryRestrictions: [],
      minRating: 3.0,
    }
  }
];