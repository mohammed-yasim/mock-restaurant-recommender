export interface RestaurantUserPreferences {
  user_id: number; // Foreign key to users table
  favoriteCuisines: string[];
  dietaryRestrictions: string[]; // e.g., "vegetarian", "gluten-free", "vegan"
  minRating: number; // 1-5
}

export interface Restaurant {
  id: number; // Our DB ID
  googlePlaceId: string;
  name: string;
  address: string;
  cuisines: string[];
  dietaryOptions: string[];
  rating: number;
}

// This type represents a row from the user_restaurant_likes table
export interface UserRestaurantLike {
    user_id: number;
    restaurant_id: number;
    liked_at: string; // Or Date object if you parse it
}