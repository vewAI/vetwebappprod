import { NextResponse } from "next/server";

export async function POST() {
	return NextResponse.json(
		{ error: "Case name normalisation endpoint is not yet implemented." },
		{ status: 501 }
	);
}

export const dynamic = "force-dynamic";
