import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/env";

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function jsonError(error: unknown, status = 500) {
  if (error instanceof ConfigError) {
    return NextResponse.json(
      { error: error.message, code: "configuration_error" },
      { status: 503 }
    );
  }

  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";

  return NextResponse.json({ error: message }, { status });
}

export function requireUuidList(bookIds: string[]) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!bookIds.length || bookIds.some((id) => !uuid.test(id))) {
    throw new Error("At least one valid selected book ID is required.");
  }
}
