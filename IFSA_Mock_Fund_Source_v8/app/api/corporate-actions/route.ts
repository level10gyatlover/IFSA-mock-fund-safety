import { getD1 } from "../../../db";
import { requireAdmin } from "../../../lib/auth";
import { applyCorporateAction, processDueCorporateActions } from "../../../lib/corporate-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    await processDueCorporateActions();
    const result = await getD1().prepare(
      `SELECT ca.id, ca.action_type AS actionType, ca.effective_at AS effectiveAt,
        ca.ratio_base AS ratioBase, ca.ratio_new AS ratioNew,
        ca.cash_per_share AS cashPerShare, ca.cost_allocation_percent AS costAllocationPercent,
        ca.source_url AS sourceUrl, ca.notes, ca.status, ca.last_error AS lastError,
        ca.created_at AS createdAt, ca.applied_at AS appliedAt,
        i.symbol, i.exchange, d.symbol AS destinationSymbol, d.exchange AS destinationExchange,
        COUNT(caa.id) AS portfoliosAffected, COALESCE(SUM(caa.cash_amount), 0) AS totalCash
       FROM corporate_actions ca JOIN instruments i ON i.id = ca.instrument_id
       LEFT JOIN instruments d ON d.id = ca.destination_instrument_id
       LEFT JOIN corporate_action_applications caa ON caa.corporate_action_id = ca.id
       GROUP BY ca.id ORDER BY ca.effective_at DESC, ca.id DESC`,
    ).all();
    return Response.json({ actions: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load corporate actions.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const payload = (await request.json()) as Record<string, unknown>;
    const operation = String(payload.operation ?? "create");
    if (operation === "applyDue") {
      if (payload.id) await applyCorporateAction(Number(payload.id));
      else await processDueCorporateActions();
      return Response.json({ ok: true });
    }

    const instrumentId = Number(payload.instrumentId);
    const destinationInstrumentId = payload.destinationInstrumentId ? Number(payload.destinationInstrumentId) : null;
    const actionType = String(payload.actionType ?? "");
    const effectiveAt = Number(payload.effectiveAt);
    const ratioBase = payload.ratioBase ? Number(payload.ratioBase) : null;
    const ratioNew = payload.ratioNew ? Number(payload.ratioNew) : null;
    const cashPerShare = payload.cashPerShare ? Number(payload.cashPerShare) : null;
    const costAllocationPercent = payload.costAllocationPercent ? Number(payload.costAllocationPercent) : null;
    const sourceUrl = String(payload.sourceUrl ?? "").trim();
    const notes = String(payload.notes ?? "").trim();
    if (!instrumentId || !["DIVIDEND", "BONUS", "SPLIT", "MERGER", "DEMERGER"].includes(actionType) || !Number.isFinite(effectiveAt)) {
      throw new Error("Choose a security, action type and effective date.");
    }
    try {
      const source = new URL(sourceUrl);
      if (!['http:', 'https:'].includes(source.protocol)) throw new Error();
    } catch {
      throw new Error("Add the official NSE, BSE, SEBI or issuer filing link used for verification.");
    }
    if (actionType === "DIVIDEND" && !(Number(cashPerShare) > 0)) throw new Error("Enter dividend cash per share.");
    if (actionType !== "DIVIDEND" && (!(Number(ratioBase) > 0) || !(Number(ratioNew) > 0))) throw new Error("Enter a positive action ratio.");
    if (["MERGER", "DEMERGER"].includes(actionType) && !destinationInstrumentId) throw new Error("Choose the destination security.");
    if (destinationInstrumentId && destinationInstrumentId === instrumentId) throw new Error("The destination security must be different from the affected security.");
    if (actionType === "DEMERGER" && !(Number(costAllocationPercent) > 0 && Number(costAllocationPercent) < 100)) {
      throw new Error("Enter the official destination cost allocation between 0% and 100%.");
    }

    const created = await getD1().prepare(
      `INSERT INTO corporate_actions
       (instrument_id, destination_instrument_id, action_type, effective_at, ratio_base, ratio_new,
        cash_per_share, cost_allocation_percent, source_url, notes, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?) RETURNING id`,
    ).bind(
      instrumentId, destinationInstrumentId, actionType, effectiveAt, ratioBase, ratioNew,
      cashPerShare, costAllocationPercent, sourceUrl, notes || null, admin.id, Date.now(),
    ).first<{ id: number }>();
    if (effectiveAt <= Date.now() && created?.id) await applyCorporateAction(created.id);
    return Response.json({ id: created?.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Corporate action could not be saved.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 400 });
  }
}
