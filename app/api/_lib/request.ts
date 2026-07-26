import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) {
    throw new ApiError(401, "Sign in with ChatGPT to access MeritOS data.");
  }
  return user;
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("MeritOS API error", error);
  return NextResponse.json(
    { error: "Something went wrong while processing this request." },
    { status: 500 },
  );
}

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, `${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown, field: string, maxLength = 10000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${field} is required.`);
  }
  if (value.length > maxLength) {
    throw new ApiError(400, `${field} is too long.`);
  }
  return value.trim();
}
