import { NextResponse } from "next/server";

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

/**
 * Creates a standardized client API error response:
 * { success: false, error: { code, message, requestId? } }
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400,
  requestId?: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorObj: ApiErrorPayload = { code, message };
  if (requestId) errorObj.requestId = requestId;
  if (details !== undefined) errorObj.details = details;

  return NextResponse.json({ success: false, error: errorObj }, { status });
}

/**
 * Handles internal server catch blocks securely.
 * Technical error details (stack, query, raw exception) are logged strictly server-side.
 * Client receives a sanitized, stable envelope without leaking internal details or raw error.message.
 */
export function apiServerError(
  err: unknown,
  code: string = "INTERNAL_SERVER_ERROR",
  fallbackMessage: string = "An unexpected internal server error occurred. Please try again later.",
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const technicalMessage = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`[API Server Error][${code}]`, technicalMessage);

  return apiError(code, fallbackMessage, 500, requestId);
}

