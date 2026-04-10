import { acrCloudIdentifyAudio } from "@/lib/acrcloud";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const sample = form.get("sample");
    if (!(sample instanceof Blob)) {
      return NextResponse.json({ error: "Missing audio sample." }, { status: 400 });
    }

    const buffer = await sample.arrayBuffer();
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "Empty audio sample." }, { status: 400 });
    }

    const result = await acrCloudIdentifyAudio(buffer);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Identification failed.";
    console.error("[identify] failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

