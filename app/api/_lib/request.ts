import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireApiUser() {
  const { userId } = await auth();
  if (!userId) throw new ApiError(401, "Sign in to access MeritOS data.");
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) throw new ApiError(400, "Your account needs an email address.");
  return {
    id: userId,
    email,
    displayName:
      clerkUser?.fullName ?? clerkUser?.firstName ?? email.split("@")[0],
  };
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
