import type { Restaurant, RestaurantUserPreferences } from './types';
import type { User } from '../common/types'; // Common User type

const CUISINE_MATCH_SCORE = 30;
const DIETARY_MATCH_SCORE = 50;
const RATING_BONUS_PER_POINT = 5;

function arrayIntersects<T>(arr1: T[], arr2: T[]): boolean {
    return arr1.some(item => arr2.includes(item));
}

function calculateRestaurantMatchScore(
    restaurant: Restaurant,
    preferences: RestaurantUserPreferences
): number {
    let score = 0;

    // Cuisine Match
    const userCuisines = preferences.favoriteCuisines;
    if (userCuisines.includes("Any") || userCuisines.length === 0) {
        score += CUISINE_MATCH_SCORE / 2;
    } else if (arrayIntersects(restaurant.cuisines, userCuisines)) {
        score += CUISINE_MATCH_SCORE;
    }

    // Dietary Restrictions Match
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
            return 0; // Hard filter: dietary needs not met
        }
    } else {
        score += DIETARY_MATCH_SCORE / 5; // Small bonus for no restrictions to worry about
    }

    // Rating Match
    if (restaurant.rating >= preferences.minRating) {
        score += (restaurant.rating - preferences.minRating) * RATING_BONUS_PER_POINT;
        score += 10; // Base score for meeting min rating
    } else {
        if (score < (CUISINE_MATCH_SCORE + DIETARY_MATCH_SCORE) / 2) return 0; // Filter if not strong match
    }

    score += Math.random() * 2; // Smaller random factor for restaurants
    return score;
}

export async function getRestaurantRecommendations(
    user: User, // Current generic user
    userPrefs: RestaurantUserPreferences, // Specific restaurant preferences for this user
    allRestaurants: Restaurant[],
    excludeRestaurantIds: Set<number> = new Set()
): Promise<Restaurant[]> {
    const scoredRestaurants = allRestaurants
        .filter(r => r.id !== undefined && !excludeRestaurantIds.has(r.id))
        .map(restaurant => ({
            restaurant,
            score: calculateRestaurantMatchScore(restaurant, userPrefs),
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

    return scoredRestaurants.map(item => item.restaurant);
}