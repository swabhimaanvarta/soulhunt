import { NextRequest, NextResponse } from "next/server";
import { POST as verifyHandoverPost } from "@/app/api/claims/verify-handover/route";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    
    // Inject claimId if not already present in the body
    const enrichedBody = {
      ...body,
      claimId: id,
    };

    // Construct a synthetic request passing through the enriched body and headers
    const syntheticReq = new NextRequest(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(enrichedBody),
    });

    return verifyHandoverPost(syntheticReq);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to verify handover." } },
      { status: 500 }
    );
  }
}
