import { NextResponse } from "next/server";
import { runContentPipeline } from "@/lib/content-pipeline/run-pipeline";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runContentPipeline());
  } catch (error) {
    console.error("[cron/generate-practice-cases]", error);
    return NextResponse.json({ error: "Practice-case generation failed" }, { status: 500 });
  }
}
