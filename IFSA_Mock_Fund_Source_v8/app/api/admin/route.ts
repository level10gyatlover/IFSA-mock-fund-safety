import { getD1 } from "../../../db";
import { createMemberAccount, requireAdmin } from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "");
    if (action === "createMember") {
      const username = String(payload.username ?? "").trim().toLowerCase();
      const displayName = String(payload.displayName ?? "").trim();
      const password = String(payload.password ?? "");
      const capital = Number(payload.capital ?? 0);
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("Use a simple 3–30 character username.");
      if (!displayName || password.length < 8 || capital < 0) throw new Error("Add a name, an 8+ character password and valid capital.");
      const id = await createMemberAccount({ username, displayName, password, capital });
      return Response.json({ id }, { status: 201 });
    }
    if (action === "deleteMember") {
      const userId = Number(payload.userId);
      if (!userId || userId === admin.id) throw new Error("The administrator account cannot be deleted.");
      const db = getD1();
      const member = await db.prepare(
        `SELECT u.id, u.role, p.id AS portfolioId, p.kind
         FROM users u LEFT JOIN portfolios p ON p.owner_user_id = u.id
         WHERE u.id = ? LIMIT 1`,
      ).bind(userId).first<{ id: number; role: string; portfolioId: number | null; kind: string | null }>();
      if (!member || member.role !== "member" || member.kind !== "member" || !member.portfolioId) {
        throw new Error("Only individual member accounts can be deleted.");
      }
      await db.batch([
        db.prepare("DELETE FROM orders WHERE portfolio_id = ? OR created_by = ?").bind(member.portfolioId, userId),
        db.prepare("DELETE FROM positions WHERE portfolio_id = ?").bind(member.portfolioId),
        db.prepare("DELETE FROM cash_ledger WHERE portfolio_id = ?").bind(member.portfolioId),
        db.prepare("DELETE FROM snapshots WHERE portfolio_id = ?").bind(member.portfolioId),
        db.prepare("DELETE FROM recommendations WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM watchlist_items WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM learning_progress WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM corporate_action_applications WHERE portfolio_id = ?").bind(member.portfolioId),
        db.prepare("DELETE FROM chat_messages WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM portfolios WHERE id = ?").bind(member.portfolioId),
        db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
        db.prepare("UPDATE chat_room_meta SET revision = revision + 1 WHERE id = 1"),
      ]);
      return Response.json({ ok: true });
    }
    if (action === "adjustFunds") {
      const portfolioId = Number(payload.portfolioId);
      const amount = Number(payload.amount);
      const reason = String(payload.reason ?? "").trim();
      const occurredAt = payload.occurredAt ? Number(payload.occurredAt) : Date.now();
      if (!portfolioId || !Number.isFinite(amount) || amount === 0 || !reason) throw new Error("Portfolio, non-zero amount and reason are required.");
      const portfolio = await getD1().prepare("SELECT cash FROM portfolios WHERE id = ?").bind(portfolioId).first<{ cash: number }>();
      if (!portfolio || portfolio.cash + amount < 0) throw new Error("Withdrawal exceeds available cash.");
      await getD1().batch([
        getD1().prepare("UPDATE portfolios SET cash = cash + ?, net_contributions = net_contributions + ? WHERE id = ?").bind(amount, amount, portfolioId),
        getD1().prepare(
          `INSERT INTO cash_ledger (portfolio_id, amount, action, reason, created_by, occurred_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(portfolioId, amount, amount > 0 ? "DEPOSIT" : "WITHDRAWAL", reason, admin.id, occurredAt, Date.now()),
      ]);
      return Response.json({ ok: true });
    }
    if (action === "updateRecommendation") {
      const id = Number(payload.id);
      const status = String(payload.status ?? "");
      const adminNote = String(payload.adminNote ?? "").trim();
      if (!id || !["NEW", "REVIEWING", "ACCEPTED", "DECLINED"].includes(status)) throw new Error("Invalid recommendation update.");
      await getD1().prepare("UPDATE recommendations SET status = ?, admin_note = ? WHERE id = ?").bind(status, adminNote || null, id).run();
      return Response.json({ ok: true });
    }
    if (action === "updateQuote") {
      const instrumentId = Number(payload.instrumentId);
      const price = Number(payload.price);
      if (!instrumentId || price <= 0) throw new Error("Select an instrument and enter a valid price.");
      await getD1().prepare(
        "UPDATE instruments SET previous_close = last_price, last_price = ?, price_source = 'admin', updated_at = ? WHERE id = ?",
      ).bind(price, Date.now(), instrumentId).run();
      return Response.json({ ok: true });
    }
    if (action === "addInstrument") {
      const symbol = String(payload.symbol ?? "").trim().toUpperCase();
      const exchange = String(payload.exchange ?? "").trim().toUpperCase();
      const name = String(payload.name ?? "").trim();
      const assetType = String(payload.assetType ?? "").trim();
      const lotSize = Number(payload.lotSize ?? 1);
      const marginPercent = Number(payload.marginPercent ?? 100);
      const lastPrice = Number(payload.lastPrice);
      const expiry = payload.expiry ? new Date(String(payload.expiry)).getTime() : null;
      if (!symbol || !exchange || !name || !assetType || lotSize < 1 || marginPercent <= 0 || lastPrice <= 0) {
        throw new Error("Complete all instrument fields with valid values.");
      }
      await getD1().prepare(
        `INSERT INTO instruments
         (symbol, exchange, name, asset_type, lot_size, margin_percent, expiry,
          last_price, previous_close, price_source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?)`,
      ).bind(symbol, exchange, name, assetType, lotSize, marginPercent, expiry, lastPrice, lastPrice, Date.now()).run();
      return Response.json({ ok: true }, { status: 201 });
    }
    throw new Error("Unknown administrator action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Administrator action failed.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 400 });
  }
}
