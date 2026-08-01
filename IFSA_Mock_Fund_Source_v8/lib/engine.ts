import { getD1 } from "../db";
import type { AppUser } from "./auth";
import { processDueCorporateActions } from "./corporate-actions";

export type InstrumentRow = {
  id: number;
  symbol: string;
  yahooSymbol: string | null;
  exchange: string;
  name: string;
  assetType: string;
  lotSize: number;
  marginPercent: number;
  expiry: number | null;
  strike: number | null;
  optionType: string | null;
  lastPrice: number;
  previousClose: number;
  priceSource: string;
  updatedAt: number;
};

const seededInstruments = [
  ["RELIANCE", "RELIANCE.NS", "NSE", "Reliance Industries", "Equity", 1, 100, null, null, null, 1518.4, 1506.2],
  ["HDFCBANK", "HDFCBANK.NS", "NSE", "HDFC Bank", "Equity", 1, 100, null, null, null, 2018.8, 1996.5],
  ["TCS", "TCS.NS", "NSE", "Tata Consultancy Services", "Equity", 1, 100, null, null, null, 3424.1, 3397.8],
  ["NIFTYBEES", "NIFTYBEES.NS", "NSE", "Nippon India Nifty 50 ETF", "ETF", 1, 100, null, null, null, 287.6, 285.9],
  ["GOLDBEES", "GOLDBEES.NS", "NSE", "Nippon India Gold ETF", "Commodity ETF", 1, 100, null, null, null, 81.42, 80.91],
  ["EMBASSY", "EMBASSY.NS", "NSE", "Embassy Office Parks REIT", "REIT", 1, 100, null, null, null, 414.3, 411.8],
  ["NIFTY26JULFUT", null, "NFO", "Nifty 50 July Futures", "Index Future", 65, 12, Date.UTC(2026, 6, 30), null, null, 25486.5, 25394.2],
  ["NIFTY26JUL25500CE", null, "NFO", "Nifty July 25,500 Call", "Index Option", 65, 100, Date.UTC(2026, 6, 30), 25500, "CE", 214.8, 198.3],
  ["NIFTY26JUL25000PE", null, "NFO", "Nifty July 25,000 Put", "Index Option", 65, 100, Date.UTC(2026, 6, 30), 25000, "PE", 91.7, 104.4],
  ["GOLD26AUGFUT", null, "MCX", "Gold August Futures", "Commodity Future", 1, 10, Date.UTC(2026, 7, 5), null, null, 102340, 101810],
] as const;

export async function ensureSeedData() {
  const db = getD1();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM instruments").first<{ count: number }>();
  if (Number(count?.count ?? 0) === 0) {
    const now = Date.now();
    await db.batch(
      seededInstruments.map((item) =>
        db.prepare(
          `INSERT INTO instruments
           (symbol, yahoo_symbol, exchange, name, asset_type, lot_size, margin_percent, expiry,
            strike, option_type, last_price, previous_close, price_source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(...item, item[1] ? "delayed-web" : "admin", now),
      ),
    );
  }

  const seasonCount = await db.prepare("SELECT COUNT(*) AS count FROM seasons").first<{ count: number }>();
  if (Number(seasonCount?.count ?? 0) === 0) {
    await db.prepare(
      "INSERT INTO seasons (name, starts_at, ends_at, active) VALUES (?, ?, ?, 1)",
    ).bind("IFSA Season 2026–27", Date.UTC(2026, 6, 1), Date.UTC(2027, 5, 30)).run();
  }
}

export async function refreshFreeQuotes() {
  const db = getD1();
  const instruments = (
    await db.prepare(
      `SELECT id, yahoo_symbol AS yahooSymbol, updated_at AS updatedAt
       FROM instruments WHERE yahoo_symbol IS NOT NULL`,
    ).all<{ id: number; yahooSymbol: string; updatedAt: number }>()
  ).results;
  const stale = instruments.filter((item) => Date.now() - item.updatedAt > 60_000).slice(0, 20);
  await Promise.all(
    stale.map(async (item) => {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.yahooSymbol)}?range=1d&interval=1m`,
          { headers: { "User-Agent": "Mozilla/5.0 IFSA-Education-Simulator" } },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }> };
        };
        const meta = payload.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return;
        await db.prepare(
          `UPDATE instruments SET last_price = ?, previous_close = COALESCE(?, previous_close),
           price_source = 'delayed-web', updated_at = ? WHERE id = ?`,
        ).bind(meta.regularMarketPrice, meta.chartPreviousClose ?? null, Date.now(), item.id).run();
      } catch {
        // The last successful quote remains visible with its timestamp.
      }
    }),
  );
}

export async function portfolioForUser(user: AppUser) {
  const row = await getD1()
    .prepare(
      `SELECT id, owner_user_id AS ownerUserId, name, kind, cash,
              net_contributions AS netContributions, created_at AS createdAt
       FROM portfolios WHERE owner_user_id = ? LIMIT 1`,
    )
    .bind(user.id)
    .first<{
      id: number;
      ownerUserId: number;
      name: string;
      kind: "flagship" | "member";
      cash: number;
      netContributions: number;
      createdAt: number;
    }>();
  if (!row) throw new Error("Portfolio not found.");
  return row;
}

function isDerivative(assetType: string) {
  return assetType.includes("Future") || assetType.includes("Option");
}

function orderTriggered(order: {
  side: string;
  orderType: string;
  limitPrice: number | null;
  triggerPrice: number | null;
}, price: number) {
  if (order.orderType === "MARKET") return true;
  if (order.orderType === "LIMIT") {
    return order.side === "BUY" ? price <= Number(order.limitPrice) : price >= Number(order.limitPrice);
  }
  if (["SL", "SL-M", "GTT"].includes(order.orderType)) {
    return order.side === "BUY" ? price >= Number(order.triggerPrice) : price <= Number(order.triggerPrice);
  }
  return false;
}

export async function fillOrder(orderId: number, executionPrice?: number, executionTime?: number) {
  const db = getD1();
  const order = await db.prepare(
    `SELECT o.id, o.portfolio_id AS portfolioId, o.instrument_id AS instrumentId,
            o.side, o.order_type AS orderType, o.quantity, o.limit_price AS limitPrice,
            o.trigger_price AS triggerPrice, o.status, p.cash,
            i.last_price AS lastPrice, i.asset_type AS assetType, i.lot_size AS lotSize,
            i.margin_percent AS marginPercent
     FROM orders o JOIN portfolios p ON p.id = o.portfolio_id
     JOIN instruments i ON i.id = o.instrument_id WHERE o.id = ? LIMIT 1`,
  ).bind(orderId).first<{
    id: number; portfolioId: number; instrumentId: number; side: "BUY" | "SELL";
    orderType: string; quantity: number; limitPrice: number | null; triggerPrice: number | null;
    status: string; cash: number; lastPrice: number; assetType: string; lotSize: number; marginPercent: number;
  }>();
  if (!order || order.status !== "PENDING") return { filled: false };
  const price = executionPrice ?? order.lastPrice;
  if (!executionPrice && !orderTriggered(order, price)) return { filled: false };

  const current = await db.prepare(
    `SELECT id, quantity, average_price AS averagePrice, realised_pnl AS realisedPnl
     FROM positions WHERE portfolio_id = ? AND instrument_id = ?`,
  ).bind(order.portfolioId, order.instrumentId).first<{
    id: number; quantity: number; averagePrice: number; realisedPnl: number;
  }>();
  const oldQty = current?.quantity ?? 0;
  const signedQty = order.side === "BUY" ? order.quantity : -order.quantity;
  const newQty = oldQty + signedQty;
  const derivative = isDerivative(order.assetType);
  if (!derivative && newQty < 0) throw new Error("You cannot sell more units than you hold.");

  let newAverage = current?.averagePrice ?? 0;
  let realised = current?.realisedPnl ?? 0;
  let cashChange = 0;

  if (!derivative) {
    cashChange = -signedQty * price * order.lotSize;
    if (signedQty > 0) {
      newAverage = (oldQty * newAverage + signedQty * price) / Math.max(newQty, 1);
    } else if (oldQty > 0) {
      realised += (price - newAverage) * Math.abs(signedQty) * order.lotSize;
      if (newQty === 0) newAverage = 0;
    }
  } else {
    const closesExisting = oldQty !== 0 && Math.sign(oldQty) !== Math.sign(signedQty);
    const closingQty = closesExisting ? Math.min(Math.abs(oldQty), Math.abs(signedQty)) : 0;
    const openingQty = Math.abs(signedQty) - closingQty;
    if (closingQty > 0) {
      realised += (price - newAverage) * closingQty * Math.sign(oldQty) * order.lotSize;
      const releasedMargin = closingQty * newAverage * order.lotSize * (order.marginPercent / 100);
      cashChange += releasedMargin + (price - newAverage) * closingQty * Math.sign(oldQty) * order.lotSize;
    }
    if (openingQty > 0) {
      cashChange -= openingQty * price * order.lotSize * (order.marginPercent / 100);
    }
    if (newQty === 0) newAverage = 0;
    else if (oldQty === 0 || Math.sign(oldQty) !== Math.sign(newQty)) newAverage = price;
    else if (Math.sign(oldQty) === Math.sign(signedQty)) {
      newAverage = (Math.abs(oldQty) * newAverage + Math.abs(signedQty) * price) / Math.abs(newQty);
    }
  }

  if (order.cash + cashChange < -0.01) throw new Error("Insufficient available cash or margin.");
  const now = executionTime ?? Date.now();
  const statements = [
    db.prepare("UPDATE portfolios SET cash = cash + ? WHERE id = ?").bind(cashChange, order.portfolioId),
    db.prepare(
      "UPDATE orders SET status = 'EXECUTED', executed_price = ?, executed_at = ? WHERE id = ?",
    ).bind(price, now, order.id),
  ];
  if (current) {
    statements.push(
      db.prepare(
        "UPDATE positions SET quantity = ?, average_price = ?, realised_pnl = ?, updated_at = ? WHERE id = ?",
      ).bind(newQty, newAverage, realised, now, current.id),
    );
  } else {
    statements.push(
      db.prepare(
        `INSERT INTO positions (portfolio_id, instrument_id, quantity, average_price, realised_pnl, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(order.portfolioId, order.instrumentId, newQty, newAverage, realised, now),
    );
  }
  await db.batch(statements);
  return { filled: true, price };
}

export async function processPendingOrders() {
  const pending = (
    await getD1().prepare("SELECT id FROM orders WHERE status = 'PENDING' ORDER BY id LIMIT 100").all<{ id: number }>()
  ).results;
  for (const order of pending) {
    try {
      await fillOrder(order.id);
    } catch {
      // Keep rejected conditional orders visible for administrator review.
    }
  }
}

export async function placeOrder(user: AppUser, input: {
  instrumentId: number;
  side: "BUY" | "SELL";
  orderType: string;
  quantity: number;
  limitPrice?: number | null;
  triggerPrice?: number | null;
  backdatedAt?: number | null;
  backdatedPrice?: number | null;
  note?: string;
}) {
  await processDueCorporateActions();
  const portfolio = await portfolioForUser(user);
  if (input.backdatedAt && user.role !== "admin") throw new Error("Only administrators may backdate trades.");
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be a positive whole number.");
  const allowedTypes = ["MARKET", "LIMIT", "SL", "SL-M", "GTT"];
  if (!allowedTypes.includes(input.orderType)) throw new Error("Unsupported order type.");
  const now = input.backdatedAt ?? Date.now();
  const created = await getD1().prepare(
    `INSERT INTO orders
     (portfolio_id, instrument_id, created_by, side, order_type, quantity, limit_price,
      trigger_price, status, placed_at, is_backdated, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?) RETURNING id`,
  ).bind(
    portfolio.id, input.instrumentId, user.id, input.side, input.orderType, input.quantity,
    input.limitPrice ?? null, input.triggerPrice ?? null, now, Boolean(input.backdatedAt), input.note ?? null,
  ).first<{ id: number }>();
  if (!created) throw new Error("Could not place the order.");
  if (input.orderType === "MARKET" || input.backdatedPrice) {
    await fillOrder(created.id, input.backdatedPrice ?? undefined, now);
  } else {
    await fillOrder(created.id);
  }
  return created.id;
}

export async function getDashboard(user: AppUser) {
  await ensureSeedData();
  await refreshFreeQuotes();
  await processDueCorporateActions();
  await processPendingOrders();
  const db = getD1();
  const portfolio = await portfolioForUser(user);
  const instruments = (
    await db.prepare(
      `SELECT id, symbol, yahoo_symbol AS yahooSymbol, exchange, name, asset_type AS assetType,
              lot_size AS lotSize, margin_percent AS marginPercent, expiry, strike,
              option_type AS optionType, last_price AS lastPrice, previous_close AS previousClose,
              price_source AS priceSource, updated_at AS updatedAt
       FROM instruments ORDER BY asset_type, symbol`,
    ).all<InstrumentRow>()
  ).results;
  const positionRows = (
    await db.prepare(
      `SELECT p.id, p.instrument_id AS instrumentId, p.quantity, p.average_price AS averagePrice,
              p.realised_pnl AS realisedPnl, i.symbol, i.name, i.exchange,
              i.asset_type AS assetType, i.lot_size AS lotSize, i.margin_percent AS marginPercent,
              i.last_price AS lastPrice, i.previous_close AS previousClose
       FROM positions p JOIN instruments i ON i.id = p.instrument_id
       WHERE p.portfolio_id = ? AND p.quantity != 0 ORDER BY ABS(p.quantity * i.last_price) DESC`,
    ).bind(portfolio.id).all<Record<string, number | string>>()
  ).results;
  const positions = positionRows.map((row) => {
    const derivative = isDerivative(String(row.assetType));
    const multiplier = Number(row.lotSize);
    const quantity = Number(row.quantity);
    const averagePrice = Number(row.averagePrice);
    const lastPrice = Number(row.lastPrice);
    const unrealisedPnl = (lastPrice - averagePrice) * quantity * multiplier;
    const marketValue = derivative
      ? Math.abs(quantity) * averagePrice * multiplier * (Number(row.marginPercent) / 100) + unrealisedPnl
      : quantity * lastPrice * multiplier;
    return { ...row, unrealisedPnl, marketValue, dayPnl: (lastPrice - Number(row.previousClose)) * quantity * multiplier };
  });
  const investedValue = positions.reduce((sum, position) => sum + Number(position.marketValue), 0);
  const netWorth = portfolio.cash + investedValue;
  const dayPnl = positions.reduce((sum, position) => sum + Number(position.dayPnl), 0);
  const totalPnl = netWorth - portfolio.netContributions;
  const dayKey = new Date().toISOString().slice(0, 10);
  await db.prepare(
    `INSERT INTO snapshots (portfolio_id, net_worth, cash, recorded_at, day_key)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(portfolio_id, day_key)
     DO UPDATE SET net_worth = excluded.net_worth, cash = excluded.cash, recorded_at = excluded.recorded_at`,
  ).bind(portfolio.id, netWorth, portfolio.cash, Date.now(), dayKey).run();

  const orders = (
    await db.prepare(
      `SELECT o.id, o.side, o.order_type AS orderType, o.quantity, o.limit_price AS limitPrice,
              o.trigger_price AS triggerPrice, o.status, o.executed_price AS executedPrice,
              o.placed_at AS placedAt, o.executed_at AS executedAt, o.is_backdated AS isBackdated,
              i.symbol, i.exchange FROM orders o JOIN instruments i ON i.id = o.instrument_id
       WHERE o.portfolio_id = ? ORDER BY o.id DESC LIMIT 50`,
    ).bind(portfolio.id).all<Record<string, unknown>>()
  ).results;

  const leaderboardRows = (
    await db.prepare(
      `SELECT p.id, p.name, p.kind, p.cash, p.net_contributions AS netContributions,
              u.display_name AS displayName,
              COALESCE(SUM(CASE
                WHEN i.asset_type LIKE '%Future%' OR i.asset_type LIKE '%Option%'
                THEN ABS(pos.quantity) * pos.average_price * i.lot_size * (i.margin_percent / 100)
                     + (i.last_price - pos.average_price) * pos.quantity * i.lot_size
                ELSE pos.quantity * i.last_price * i.lot_size END), 0) AS holdingsValue,
              COALESCE(SUM(pos.realised_pnl), 0) AS realisedPnl
       FROM portfolios p JOIN users u ON u.id = p.owner_user_id
       LEFT JOIN positions pos ON pos.portfolio_id = p.id AND pos.quantity != 0
       LEFT JOIN instruments i ON i.id = pos.instrument_id
       WHERE u.status = 'active' GROUP BY p.id ORDER BY p.id`,
    ).all<Record<string, number | string>>()
  ).results.map((row) => {
    const value = Number(row.cash) + Number(row.holdingsValue);
    const contribution = Number(row.netContributions);
    return {
      ...row,
      netWorth: value,
      pnl: value - contribution,
      returnPct: contribution ? ((value - contribution) / contribution) * 100 : 0,
    };
  });

  const history = (
    await db.prepare(
      "SELECT net_worth AS netWorth, recorded_at AS recordedAt FROM snapshots WHERE portfolio_id = ? ORDER BY recorded_at LIMIT 180",
    ).bind(portfolio.id).all<{ netWorth: number; recordedAt: number }>()
  ).results;

  const corporateActions = (
    await db.prepare(
      `SELECT ca.id, ca.action_type AS actionType, ca.effective_at AS effectiveAt,
              ca.ratio_base AS ratioBase, ca.ratio_new AS ratioNew,
              ca.cash_per_share AS cashPerShare, caa.quantity_before AS quantityBefore,
              caa.quantity_after AS quantityAfter, caa.destination_quantity_added AS destinationQuantityAdded,
              caa.cash_amount AS cashAmount, i.symbol, i.exchange, d.symbol AS destinationSymbol
       FROM corporate_action_applications caa
       JOIN corporate_actions ca ON ca.id = caa.corporate_action_id
       JOIN instruments i ON i.id = ca.instrument_id
       LEFT JOIN instruments d ON d.id = ca.destination_instrument_id
       WHERE caa.portfolio_id = ? ORDER BY caa.applied_at DESC LIMIT 10`,
    ).bind(portfolio.id).all<Record<string, unknown>>()
  ).results;

  const recommendations = (
    await db.prepare(
      `SELECT r.id, r.side, r.thesis, r.target_price AS targetPrice, r.stop_loss AS stopLoss,
              r.status, r.admin_note AS adminNote, r.created_at AS createdAt,
              i.symbol, i.exchange, u.display_name AS memberName
       FROM recommendations r JOIN instruments i ON i.id = r.instrument_id
       JOIN users u ON u.id = r.user_id
       ${user.role === "admin" ? "" : "WHERE r.user_id = ?"}
       ORDER BY r.id DESC LIMIT 50`,
    ).bind(...(user.role === "admin" ? [] : [user.id])).all<Record<string, unknown>>()
  ).results;

  const members = user.role === "admin"
    ? (
        await db.prepare(
          `SELECT u.id, u.username, u.display_name AS displayName, u.status, p.id AS portfolioId,
                  p.cash, p.net_contributions AS netContributions
           FROM users u JOIN portfolios p ON p.owner_user_id = u.id ORDER BY u.role, u.display_name`,
        ).all<Record<string, unknown>>()
      ).results
    : [];
  const seasons = (await db.prepare("SELECT id, name, starts_at AS startsAt, ends_at AS endsAt, active FROM seasons ORDER BY starts_at DESC").all()).results;

  return {
    user,
    portfolio,
    summary: {
      netWorth,
      cash: portfolio.cash,
      investedValue,
      dayPnl,
      totalPnl,
      returnPct: portfolio.netContributions ? (totalPnl / portfolio.netContributions) * 100 : 0,
      netContributions: portfolio.netContributions,
    },
    instruments,
    positions,
    orders,
    leaderboard: leaderboardRows,
    recommendations,
    members,
    seasons,
    history,
    corporateActions,
    quoteMode: "Free delayed feed with timestamped fallback",
  };
}
