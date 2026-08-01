import { getCurrentUser } from "../../../lib/auth";
import { getDashboard } from "../../../lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    return Response.json(await getDashboard(user));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load dashboard." }, { status: 500 });
  }
}
