import { NextResponse } from "next/server";
import { runJargonPipeline } from "@/lib/jargon-pipeline/run-pipeline";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runJargonPipeline());
  } catch (error) {
    console.error("[cron/generate-quiz-questions]", error);
    return NextResponse.json({ error: "Quiz generation failed" }, { status: 500 });
  }
}
