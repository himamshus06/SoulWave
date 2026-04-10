import crypto from "crypto";

type AcrCloudMusicItem = {
  title?: string;
  artists?: Array<{ name?: string }>;
};

type AcrCloudResponse = {
  status?: { code?: number; msg?: string };
  metadata?: { music?: AcrCloudMusicItem[] };
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Set it in .env.local / Vercel env vars.`);
  return value;
}

export async function acrCloudIdentifyAudio(sample: ArrayBuffer) {
  const host = requiredEnv("ACRCLOUD_HOST");
  const accessKey = requiredEnv("ACRCLOUD_ACCESS_KEY");
  const accessSecret = requiredEnv("ACRCLOUD_ACCESS_SECRET");

  const httpMethod = "POST";
  const httpUri = "/v1/identify";
  const dataType = "audio";
  const signatureVersion = "1";
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const stringToSign = [httpMethod, httpUri, accessKey, dataType, signatureVersion, timestamp].join("\n");
  const signature = crypto
    .createHmac("sha1", accessSecret)
    .update(stringToSign, "utf8")
    .digest("base64");

  const sampleBytes = sample.byteLength;
  const form = new FormData();
  form.set("access_key", accessKey);
  form.set("data_type", dataType);
  form.set("signature_version", signatureVersion);
  form.set("signature", signature);
  form.set("timestamp", timestamp);
  form.set("sample_bytes", String(sampleBytes));
  form.set("sample", new Blob([sample], { type: "audio/webm" }), "sample.webm");

  const response = await fetch(`https://${host}${httpUri}`, {
    method: "POST",
    body: form,
    // Don't cache recognition results.
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ACRCloud request failed (${response.status}). ${text}`.trim());
  }

  const data = (await response.json()) as AcrCloudResponse;
  const code = data.status?.code ?? -1;
  if (code !== 0) {
    const msg = data.status?.msg ?? "Unrecognized audio.";
    return { matched: false as const, code, message: msg };
  }

  const first = data.metadata?.music?.[0];
  const title = first?.title?.trim() ?? "";
  const artist = first?.artists?.[0]?.name?.trim() ?? "";
  if (!title && !artist) {
    return { matched: false as const, code: 0, message: "No track metadata returned." };
  }

  return { matched: true as const, title, artist };
}

