import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "meritos-api",
    safeguards: {
      automaticSubmission: false,
      privateTraining: false,
      unsupportedClaims: "blocked",
    },
  });
}
