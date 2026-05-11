interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

export const detectUserLocation = async (): Promise<string | null> => {
  try {
    // Check if geolocation is available
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return null;
    }

    // Get user's coordinates
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const { latitude, longitude } = position.coords;

    // Use reverse geocoding to get address (using free API)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'community-frontend/1.0' // Replace with your app name
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const address = data.address;
        
        // Format location string
        const locationParts = [
          address.city || address.town || address.village,
        ].filter(Boolean);

        return locationParts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }
    } catch (geocodingError) {
      console.warn('Geocoding failed, using coordinates:', geocodingError);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    // Fallback to coordinates if geocoding fails
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  } catch (error) {
    console.error('Location detection failed:', error);
    return null;
  }
};
