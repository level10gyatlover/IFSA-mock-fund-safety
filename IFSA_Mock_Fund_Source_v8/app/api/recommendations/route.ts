import { getD1 } from "../../../db";
import { requireUser } from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as {
      instrumentId?: number; side?: string; thesis?: string; targetPrice?: number; stopLoss?: number;
    };
    if (!payload.instrumentId || !payload.side || !payload.thesis?.trim()) {
      return Response.json({ error: "Instrument, action and investment thesis are required." }, { status: 400 });
    }
    await getD1().prepare(
      `INSERT INTO recommendations
       (user_id, instrument_id, side, thesis, target_price, stop_loss, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'NEW', ?)`,
    ).bind(user.id, payload.instrumentId, payload.side, payload.thesis.trim(), payload.targetPrice ?? null, payload.stopLoss ?? null, Date.now()).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit recommendation.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}
