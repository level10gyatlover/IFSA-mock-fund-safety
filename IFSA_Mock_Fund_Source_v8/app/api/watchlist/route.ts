import { getD1 } from "../../../db";
import { requireUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const watchlistSelect = `SELECT w.id, w.sort_order AS sortOrder, w.created_at AS createdAt,
  i.id AS instrumentId, i.symbol, i.exchange, i.name, i.asset_type AS assetType,
  i.lot_size AS lotSize, i.margin_percent AS marginPercent, i.expiry,
  i.last_price AS lastPrice, i.previous_close AS previousClose,
  i.price_source AS priceSource, i.updated_at AS updatedAt
  FROM watchlist_items w JOIN instruments i ON i.id = w.instrument_id`;

export async function GET() {
  try {
    const user = await requireUser();
    const result = await getD1().prepare(
      `${watchlistSelect} WHERE w.user_id = ? ORDER BY w.sort_order, w.id`,
    ).bind(user.id).all();
    return Response.json({ items: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the watchlist.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as { instrumentId?: unknown };
    const instrumentId = Number(payload.instrumentId);
    if (!instrumentId) return Response.json({ error: "Choose a valid instrument." }, { status: 400 });
    const db = getD1();
    const instrument = await db.prepare("SELECT id FROM instruments WHERE id = ?").bind(instrumentId).first();
    if (!instrument) return Response.json({ error: "That instrument is no longer available." }, { status: 404 });
    const next = await db.prepare(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM watchlist_items WHERE user_id = ?",
    ).bind(user.id).first<{ nextOrder: number }>();
    await db.prepare(
      `INSERT INTO watchlist_items (user_id, instrument_id, sort_order, created_at)
       VALUES (?, ?, ?, ?) ON CONFLICT(user_id, instrument_id) DO NOTHING`,
    ).bind(user.id, instrumentId, Number(next?.nextOrder ?? 0), Date.now()).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add to the watchlist.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as { id?: unknown; direction?: unknown };
    const id = Number(payload.id);
    const direction = String(payload.direction ?? "");
    if (!id || !["up", "down"].includes(direction)) {
      return Response.json({ error: "Choose a watchlist item and direction." }, { status: 400 });
    }
    const db = getD1();
    const current = await db.prepare(
      "SELECT id, sort_order AS sortOrder FROM watchlist_items WHERE id = ? AND user_id = ?",
    ).bind(id, user.id).first<{ id: number; sortOrder: number }>();
    if (!current) return Response.json({ error: "That watchlist item no longer exists." }, { status: 404 });
    const operator = direction === "up" ? "<" : ">";
    const order = direction === "up" ? "DESC" : "ASC";
    const neighbour = await db.prepare(
      `SELECT id, sort_order AS sortOrder FROM watchlist_items
       WHERE user_id = ? AND sort_order ${operator} ? ORDER BY sort_order ${order}, id ${order} LIMIT 1`,
    ).bind(user.id, current.sortOrder).first<{ id: number; sortOrder: number }>();
    if (neighbour) {
      await db.batch([
        db.prepare("UPDATE watchlist_items SET sort_order = ? WHERE id = ? AND user_id = ?").bind(neighbour.sortOrder, current.id, user.id),
        db.prepare("UPDATE watchlist_items SET sort_order = ? WHERE id = ? AND user_id = ?").bind(current.sortOrder, neighbour.id, user.id),
      ]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reorder the watchlist.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Choose a watchlist item." }, { status: 400 });
    const result = await getD1().prepare(
      "DELETE FROM watchlist_items WHERE id = ? AND user_id = ?",
    ).bind(id, user.id).run();
    if (!result.meta.changes) return Response.json({ error: "That watchlist item no longer exists." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove the watchlist item.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}
