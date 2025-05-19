// src/recommender.ts
import type { User, Restaurant, UserPreferences } from './types';
import { getAllRestaurants } from './database';

const CUISINE_MATCH_SCORE = 30;
const DIETARY_MATCH_SCORE = 50; // Higher weight for dietary needs
const RATING_BONUS_PER_POINT = 5; // Bonus for higher rating than min

// Helper to check if any element of arr1 is in arr2
function arrayIntersects<T>(arr1: T[], arr2: T[]): boolean {
  return arr1.some(item => arr2.includes(item));
}

function calculateMatchScore(restaurant: Restaurant, preferences: UserPreferences): number {
  let score = 0;

  // 1. Cuisine Match
  const userCuisines = preferences.favoriteCuisines;
  if (userCuisines.includes("Any") || userCuisines.length === 0) {
    score += CUISINE_MATCH_SCORE / 2; // Small bonus for any cuisine if user is open
  } else if (arrayIntersects(restaurant.cuisines, userCuisines)) {
    score += CUISINE_MATCH_SCORE;
  }

  // 2. Dietary Restrictions Match
  // All user's restrictions must be met by restaurant's options
  const userRestrictions = preferences.dietaryRestrictions;
  if (userRestrictions.length > 0) {
    const meetsAllRestrictions = userRestrictions.every(restriction =>
      restaurant.dietaryOptions.some(option => 
        option.toLowerCase().includes(restriction.toLowerCase())
      )
    );
    if (meetsAllRestrictions) {
      score += DIETARY_MATCH_SCORE;
    } else {
      return 0; // Hard filter: if dietary needs aren't met, score is 0
    }
  } else {
    // No dietary restrictions, give a small neutral score or skip
    score += DIETARY_MATCH_SCORE / 5; // Small bonus for not having restrictions to worry about
  }


  // 3. Rating Match
  if (restaurant.rating >= preferences.minRating) {
    score += (restaurant.rating - preferences.minRating) * RATING_BONUS_PER_POINT;
    score += 10; // Base score for meeting min rating
  } else {
     // If below minRating, penalize or filter out.
     // For this simple version, let's not recommend if below min rating unless score is already high
     if (score < (CUISINE_MATCH_SCORE + DIETARY_MATCH_SCORE) / 2) return 0; // Filter out if not a strong match otherwise
  }
  
  // Add a small random factor to break ties and add variety
  score += Math.random() * 5;


  return score;
}

export async function getRecommendations(
  user: User,
  allRestaurants: Restaurant[],
  excludeIds: Set<number> = new Set()
): Promise<Restaurant[]> {
  
  const scoredRestaurants = allRestaurants
    .filter(r => r.id !== undefined && !excludeIds.has(r.id)) // Ensure ID exists and not excluded
    .map(restaurant => ({
      restaurant,
      score: calculateMatchScore(restaurant, user.preferences),
    }))
    .filter(item => item.score > 0) // Only keep restaurants with a positive score
    .sort((a, b) => b.score - a.score); // Sort by score descending

  return scoredRestaurants.map(item => item.restaurant);
}