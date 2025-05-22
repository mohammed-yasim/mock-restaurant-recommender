// Example import:
import type { Restaurant as ApiRestaurantData } from './types';
import chalk from 'chalk';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

function mapGoogleTypesToCuisines(googleTypes: string[] | undefined, placeName: string): string[] {
    // ... (same implementation as before)
    if (!googleTypes) return ['Miscellaneous'];

    const cuisines: string[] = [];
    const typeMap: Record<string, string> = {
        'cafe': 'Cafe',
        'bakery': 'Bakery',
        'bar': 'Bar',
    };
    const nameKeywords: Record<string, string> = {
        'pizza': 'Pizza', 'sushi': 'Sushi', 'burger': 'Burgers', 'taco': 'Mexican',
        'pho': 'Vietnamese', 'curry': 'Indian', 'pasta': 'Italian', 'steakhouse': 'Steakhouse',
    };
    googleTypes.forEach(type => {
        if (typeMap[type]) {
            if (!cuisines.includes(typeMap[type])) cuisines.push(typeMap[type]);
        } else if (type.includes('_restaurant')) {
            const cuisine = type.replace('_restaurant', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            if (!cuisines.includes(cuisine)) cuisines.push(cuisine);
        }
    });
    for (const keyword in nameKeywords) {
        if (placeName.toLowerCase().includes(keyword)) {
            const cuisineFromName = nameKeywords[keyword];
            if (cuisineFromName && !cuisines.includes(cuisineFromName)) {
                cuisines.push(cuisineFromName);
            }
        }
    }
    if (googleTypes.includes('restaurant') && cuisines.length === 0) cuisines.push('Restaurant');
    if (cuisines.length === 0) cuisines.push('Food');
    return [...new Set(cuisines)];
}

function mapGoogleTypesToDietary(googleTypes: string[] | undefined): string[] {
    // ... (same implementation as before)
    if (!googleTypes) return [];
    const dietary: string[] = [];
    if (googleTypes.includes('vegetarian_restaurant')) dietary.push('vegetarian');
    if (googleTypes.includes('vegan_restaurant')) dietary.push('vegan');
    return [...new Set(dietary)];
}


// The return type here is Omit<Restaurant, 'id'> because the 'id' is assigned by our DB.
export async function fetchRestaurantsFromGooglePlaces(
  locationQuery: string,
  maxResults: number = 20
): Promise<Omit<ApiRestaurantData, 'id'>[]> { // Use the imported Restaurant type
  if (!API_KEY) {
    console.error(chalk.red.bold("Google Places API key not found (GOOGLE_PLACES_API_KEY)."));
    return [];
  }

  const query = `restaurants in ${locationQuery}`;
  const params = new URLSearchParams({ query: query, key: API_KEY, type: 'restaurant' });
  const url = `${BASE_URL}?${params.toString()}`;
  console.log(chalk.blue(`\n[Google API] Fetching restaurants for query: "${query}"...`));

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(chalk.red(`[Google API] Error: ${response.status}`), errorBody);
      return [];
    }
    const data = await response.json() as any;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(chalk.red(`[Google API] API Status Error: ${data.status} - ${data.error_message || ''}`));
      return [];
    }
    if (data.status === "ZERO_RESULTS" || !data.results || data.results.length === 0) {
      console.log(chalk.yellow(`[Google API] No restaurants found for: "${query}".`));
      return [];
    }

    const fetchedRestaurants: Omit<ApiRestaurantData, 'id'>[] = data.results
      .slice(0, maxResults)
      .map((place: any): Omit<ApiRestaurantData, 'id'> => ({ // Ensure this mapping matches your Restaurant type
        googlePlaceId: place.place_id,
        name: place.name || 'Name N/A',
        address: place.formatted_address || place.vicinity || 'Address N/A',
        cuisines: mapGoogleTypesToCuisines(place.types, place.name || ''),
        dietaryOptions: mapGoogleTypesToDietary(place.types),
        rating: place.rating || 0,
      }));
    
    console.log(chalk.green(`[Google API] Fetched ${fetchedRestaurants.length} restaurants.`));
    return fetchedRestaurants;

  } catch (error: any) {
    console.error(chalk.red("[Google API] Exception:"), error.message);
    return [];
  }
}