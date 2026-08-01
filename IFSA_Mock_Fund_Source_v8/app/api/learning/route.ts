import { getD1 } from "../../../db";
import { requireUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const allowedModules = new Set(["basics", "stocks", "orders", "portfolio", "derivatives"]);

export async function GET() {
  try {
    const user = await requireUser();
    const result = await getD1().prepare(
      `SELECT module_key AS moduleKey, completed, quiz_score AS quizScore, updated_at AS updatedAt
       FROM learning_progress WHERE user_id = ? ORDER BY module_key`,
    ).bind(user.id).all();
    return Response.json({ progress: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load learning progress.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as { moduleKey?: unknown; completed?: unknown; quizScore?: unknown };
    const moduleKey = String(payload.moduleKey ?? "");
    const quizScore = Math.max(0, Math.min(3, Math.round(Number(payload.quizScore ?? 0))));
    if (!allowedModules.has(moduleKey)) return Response.json({ error: "Unknown learning module." }, { status: 400 });
    await getD1().prepare(
      `INSERT INTO learning_progress (user_id, module_key, completed, quiz_score, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, module_key) DO UPDATE SET
       completed = excluded.completed, quiz_score = MAX(learning_progress.quiz_score, excluded.quiz_score), updated_at = excluded.updated_at`,
    ).bind(user.id, moduleKey, Boolean(payload.completed), quizScore, Date.now()).run();
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save learning progress.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}
