import { config } from "dotenv";
import { resolve } from "path";
import { docClient, getAllCities } from "./common";
import { UpdateCommand, UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import { City } from "@/app/_db/schema";

config({ path: resolve(process.cwd(), ".env.local") });

const center = "37.7792588,-122.4193286";

async function main() {
  const cities = await getAllCities();

  // Find cities around center
  const closeCities = cities.filter((c) => {
    const [lat, lon] = c.id.split(",").map(parseFloat);
    const [centerLat, centerLon] = center.split(",").map(parseFloat);
    if (
      lat === undefined ||
      lon === undefined ||
      centerLat === undefined ||
      centerLon === undefined
    )
      return false;
    return areCoordinatesNearby(lat, lon, centerLat, centerLon, 100);
  });

  console.log(closeCities.map((c) => c.id));
  console.log(closeCities.map((c) => c.name));

  const citiesError: { city: City; res: UpdateCommandOutput }[] = [];
  for (const city of closeCities) {
    const updateCommand = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: {
        entityType: "CITY",
        entityId: city.id,
      },
      UpdateExpression: "SET communityLinks = :links",
      ExpressionAttributeValues: {
        ":links": [
          // ...city.communityLinks ?? [], // TO add if we don't want to override
          {
            link: "https://discord.gg/Cvb6Sse7YK",
            name: "meet.hn Bay Area Discord",
          },
        ],
      },
    });

    const updateResponse = await docClient.send(updateCommand);
    if (updateResponse.$metadata.httpStatusCode !== 200) {
      citiesError.push({ city, res: updateResponse });
    }
  }

  console.log("errors:", citiesError);
}

main();

/**
 * From Claude 3.5 Haiku:
 *
 * Checks if two geographical coordinates are within a specified distance of each other.
 *
 * @param {number} lat1 - Latitude of the first coordinate
 * @param {number} lon1 - Longitude of the first coordinate
 * @param {number} lat2 - Latitude of the second coordinate
 * @param {number} lon2 - Longitude of the second coordinate
 * @param {number} [maxDistanceKm=1] - Maximum distance in kilometers to consider coordinates "nearby" (default is 1 km)
 * @returns {boolean} - True if coordinates are within maxDistanceKm, false otherwise
 */
function areCoordinatesNearby(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  maxDistanceKm: number = 50,
): boolean {
  // Earth's radius in kilometers
  const R = 6371;

  // Convert latitude and longitude to radians
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance in kilometers
  const distance = R * c;

  // Check if distance is within maxDistanceKm
  return distance <= maxDistanceKm;
}
