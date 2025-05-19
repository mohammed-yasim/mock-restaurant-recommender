// src/googleApiService.ts
import type { Restaurant } from './types';
import chalk from 'chalk';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Using the "older" Places API Text Search - often simpler for "restaurants in city"
const BASE_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

/**
 * Maps Google's place types to a more usable list of cuisines.
 * This is a simplified mapping and would need significant expansion for real-world accuracy.
 * Google's 'types' array is often generic.
 */
function mapGoogleTypesToCuisines(googleTypes: string[] | undefined, placeName: string): string[] {
    if (!googleTypes) return ['Miscellaneous'];

    const cuisines: string[] = [];
    const typeMap: Record<string, string> = {
        'cafe': 'Cafe',
        'bakery': 'Bakery',
        'bar': 'Bar',
        // Add more direct mappings if Google provides specific types like "italian_restaurant"
    };

    // Keywords to infer cuisines from place name (very basic)
    const nameKeywords: Record<string, string> = {
        'pizza': 'Pizza',
        'sushi': 'Sushi',
        'burger': 'Burgers',
        'taco': 'Mexican',
        'pho': 'Vietnamese',
        'curry': 'Indian', // Could be Thai, Japanese etc. - needs refinement
        'pasta': 'Italian',
        'steakhouse': 'Steakhouse',
    };

    googleTypes.forEach(type => {
        if (typeMap[type]) {
            if (!cuisines.includes(typeMap[type])) cuisines.push(typeMap[type]);
        } else if (type.includes('_restaurant')) {
            // e.g., "chinese_restaurant" -> "Chinese"
            const cuisine = type.replace('_restaurant', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            if (!cuisines.includes(cuisine)) cuisines.push(cuisine);
        }
    });

    // Infer from name
    for (const keyword in nameKeywords) {
        if (placeName.toLowerCase().includes(keyword)) {
            const cuisineFromName = nameKeywords[keyword];
            if (cuisineFromName && !cuisines.includes(cuisineFromName)) {
                cuisines.push(cuisineFromName);
            }
        }
    }

    if (googleTypes.includes('restaurant') && cuisines.length === 0) {
        cuisines.push('Restaurant'); // Generic fallback
    }
    if (cuisines.length === 0) {
        cuisines.push('Food'); // Broader fallback
    }

    return [...new Set(cuisines)]; // Return unique cuisines
}

/**
 * Attempts to infer dietary options. This is very limited with the Places API.
 * "vegetarian_restaurant" or "vegan_restaurant" types are rare or non-standard.
 */
function mapGoogleTypesToDietary(googleTypes: string[] | undefined): string[] {
    if (!googleTypes) return [];
    const dietary: string[] = [];
    if (googleTypes.includes('vegetarian_restaurant')) { // This specific type may not be standard
        dietary.push('vegetarian');
    }
    if (googleTypes.includes('vegan_restaurant')) { // This specific type may not be standard
        dietary.push('vegan');
    }
    // In a real app, this data often comes from specific business details, menus, or user-generated content.
    return [...new Set(dietary)];
}

export async function fetchRestaurantsFromGooglePlaces(
  locationQuery: string, // e.g., "London", "restaurants near Eiffel Tower"
  maxResults: number = 20 // Google's default is 20, max is 60 (requires pagination)
): Promise<Omit<Restaurant, 'id'>[]> {
  if (!API_KEY) {
    console.error(
      chalk.red.bold("Google Places API key not found. Please set GOOGLE_PLACES_API_KEY in your .env file.")
    );
    // Fallback to empty or throw an error, preventing further execution.
    // For this example, we'll return empty and let the app handle it.
    return [];
    // throw new Error("API key missing. Cannot fetch restaurants from Google Places.");
  }

  // Construct query: search for "restaurants" in the given "locationQuery"
  const query = `restaurants in ${locationQuery}`;
  const params = new URLSearchParams({
    query: query,
    key: API_KEY,
    type: 'restaurant', // Bias results towards restaurants
    // language: 'en', // Optional: specify language for results
    // opennow: 'true', // Optional: only show places open now
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(chalk.blue(`\n[Google API] Fetching restaurants for query: "${query}"...`));
  // Avoid logging the full URL with API key in production logs
  // console.log(`[Google API] URL: ${url.replace(API_KEY, 'YOUR_API_KEY_REDACTED')}`);


  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(chalk.red(`[Google API] Error fetching data: ${response.status} ${response.statusText}`), errorBody);
      // Consider specific handling for 403 (key issue), 429 (quota), etc.
      return []; // Return empty on HTTP error
    }

    const data = await response.json() as any; // Use 'any' for Google's dynamic response, or create detailed types

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(chalk.red(`[Google API] API Error: ${data.status} - ${data.error_message || 'No specific error message.'}`));
      if (data.status === "REQUEST_DENIED" && data.error_message?.includes("API key")) {
        console.error(chalk.red.bold("This might be an issue with your API key (invalid, not enabled for Places API, or billing not set up)."));
      }
      return []; // Return empty on API status error
    }

    if (data.status === "ZERO_RESULTS" || !data.results || data.results.length === 0) {
      console.log(chalk.yellow(`[Google API] No restaurants found for query: "${query}".`));
      return [];
    }

    const fetchedRestaurants: Omit<Restaurant, 'id'>[] = data.results
      .slice(0, maxResults) // Respect maxResults, though API usually limits to 20 per page without pagination
      .map((place: any) => {
        const cuisines = mapGoogleTypesToCuisines(place.types, place.name || '');
        const dietaryOptions = mapGoogleTypesToDietary(place.types);

        return {
          googlePlaceId: place.place_id,
          name: place.name || 'Name N/A',
          address: place.formatted_address || place.vicinity || 'Address N/A',
          cuisines: cuisines,
          dietaryOptions: dietaryOptions, // Will likely be empty often
          rating: place.rating || 0, // Default to 0 if no rating
        };
      });
    
    console.log(chalk.green(`[Google API] Successfully fetched ${fetchedRestaurants.length} restaurants (from ${data.results.length} raw results).`));
    return fetchedRestaurants;

  } catch (error: any) {
    console.error(chalk.red("[Google API] Exception during fetch operation:"), error.message);
    return []; // Fallback to empty array on unexpected errors
  }
}

/*
// Example for "Places API (New)" - Text Search (POST request)
// This requires "Places API (New)" enabled in GCP and uses a different endpoint & structure.
const TEXT_SEARCH_URL_NEW = "https://places.googleapis.com/v1/places:searchText";

export async function fetchRestaurantsFromGooglePlacesNewAPI(
  locationTextQuery: string,
  maxResults: number = 10
): Promise<Omit<Restaurant, 'id'>[]> {
  if (!API_KEY) { /* ... error ... * / return []; }

  const requestBody = {
    textQuery: `restaurant in ${locationTextQuery}`,
    maxResultCount: maxResults,
    // languageCode: "en",
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': API_KEY,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.primaryType,places.rating'
    // Note: `primaryType` is often better than `types` for cuisine in the new API.
    // `displayName` is an object with `text` and `languageCode`.
  };

  try {
    const response = await fetch(TEXT_SEARCH_URL_NEW, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
    });
    // ... handle response and map data similarly ...
    // const data = await response.json() as any;
    // if (!data.places || data.places.length === 0) return [];
    // return data.places.map(place => {
    //   return {
    //     googlePlaceId: place.id,
    //     name: place.displayName?.text || 'N/A',
    //     address: place.formattedAddress || 'N/A',
    //     cuisines: place.primaryType ? [place.primaryType.charAt(0).toUpperCase() + place.primaryType.slice(1).replace(/_/g, ' ')] : ['Restaurant'],
    //     dietaryOptions: [], // Still hard to get
    //     rating: place.rating || 0,
    //   };
    // });
    return []; // Placeholder
  } catch (error) {
    console.error("[Google API New] Exception:", error);
    return [];
  }
}
*/