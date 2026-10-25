import { NextResponse } from "next/server";
export { apiError, apiServerError } from "./api-error";
export type { ApiErrorPayload, ApiErrorResponse } from "./api-error";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Creates a standardized client API success response:
 * { success: true, data, meta? }
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  meta?: Record<string, unknown>
): NextResponse<ApiSuccessResponse<T>> {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };

  return NextResponse.json(payload, { status });
}
