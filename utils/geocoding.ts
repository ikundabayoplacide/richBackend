import axios from "axios";

interface LocationData {
  sector?: string;
  district?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationData> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;

  const response = await axios.get(url, {
    headers: { "User-Agent": "SurveyApp/1.0" }
  });

  const address = response.data?.address || {};
  
  return {
    sector: address.suburb || address.neighbourhood || address.quarter,
    district: address.state_district || address.county || address.city_district
  };
}
