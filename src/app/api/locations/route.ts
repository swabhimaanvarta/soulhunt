import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CampusLocation } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { isWithinCampusBounds } from "@/lib/campus-constants";
import { apiSuccess, apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const safeDeskOnly = searchParams.get("safeDesk") === "true";

    const filter: any = { isActive: true };
    if (safeDeskOnly) {
      filter.isSafeDesk = true;
    }

    const locations = await CampusLocation.find(filter).sort({ name: 1 }).lean();
    return apiSuccess(locations);
  } catch (error: any) {
    return apiError("LOCATIONS_FETCH_FAILED", error.message || "Failed to fetch locations.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return apiError("UNAUTHORIZED", "Admin access required.", 403);
    }

    const body = await req.json();
    await connectDB();

    const lat = body.coordinates?.lat ?? body.lat;
    const lng = body.coordinates?.lng ?? body.lng;

    if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return apiError("INVALID_COORDINATES", "Coordinates (lat, lng) are required.", 400);
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    if (!isWithinCampusBounds(numLat, numLng)) {
      return apiError(
        "OUT_OF_BOUNDS",
        `Coordinates (${numLat.toFixed(5)}, ${numLng.toFixed(5)}) are outside the approved AIEM campus perimeter [15.5890, 73.7880] to [15.6010, 73.8020].`,
        400
      );
    }

    const locationData = {
      ...body,
      coordinates: {
        lat: numLat,
        lng: numLng,
        mapX: Number(body.coordinates?.mapX ?? body.mapX ?? 0),
        mapY: Number(body.coordinates?.mapY ?? body.mapY ?? 0),
      },
    };

    const location = await CampusLocation.create(locationData);
    return apiSuccess(location, 201);
  } catch (error: any) {
    return apiError("LOCATION_CREATION_FAILED", error.message || "Failed to create location.", 400);
  }
}


