import { NextResponse } from "next/server";
import { getUploadPresignedUrl } from "@/lib/r2";

export async function POST(request: Request) {
  try {
    // Read user token or check auth session here if needed (e.g. from cookies/headers).
    // For local development sandbox, we generate the presigned URL directly.
    const { filename, fileType } = await request.json();

    if (!filename || !fileType) {
      return NextResponse.json(
        { error: "Missing filename or fileType parameters" },
        { status: 400 }
      );
    }

    // Creating unique keys for listings (e.g. listings/{timestamp}-{random}.jpg)
    const fileExtension = filename.split(".").pop() || "jpg";
    const uniqueKey = `listings/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;

    // Get signed PUT url from Cloudflare R2
    const uploadUrl = await getUploadPresignedUrl(uniqueKey, fileType);

    return NextResponse.json({
      uploadUrl,
      fileKey: uniqueKey,
    });
  } catch (error: any) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
