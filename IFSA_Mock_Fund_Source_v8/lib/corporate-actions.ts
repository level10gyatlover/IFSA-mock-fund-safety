import { getD1 } from "../db";

type CorporateActionRow = {
  id: number;
  instrumentId: number;
  destinationInstrumentId: number | null;
  actionType: "DIVIDEND" | "BONUS" | "SPLIT" | "MERGER" | "DEMERGER";
  effectiveAt: number;
  ratioBase: number | null;
  ratioNew: number | null;
  cashPerShare: number | null;
  costAllocationPercent: number | null;
  createdBy: number;
};

type PositionRow = {
  id: number;
  portfolioId: number;
  quantity: number;
  averagePrice: number;
  realisedPnl: number;
};

function whole(value: number, label: string) {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) > 0.000001) {
    throw new Error(`${label} would create fractional units. Confirm the cash-in-lieu treatment and enter a corrected ratio.`);
  }
  return rounded;
}

async function applyClaimedAction(action: CorporateActionRow) {
  const db = getD1();
  const positions = (
    await db.prepare(
      `SELECT id, portfolio_id AS portfolioId, quantity, average_price AS averagePrice,
              realised_pnl AS realisedPnl
       FROM positions WHERE instrument_id = ? AND quantity > 0 ORDER BY portfolio_id`,
    ).bind(action.instrumentId).all<PositionRow>()
  ).results;

  const base = Number(action.ratioBase ?? 0);
  const ratio = Number(action.ratioNew ?? 0);
  if (action.actionType !== "DIVIDEND" && (!(base > 0) || !(ratio > 0))) {
    throw new Error("A positive corporate-action ratio is required.");
  }
  if (["MERGER", "DEMERGER"].includes(action.actionType) && !action.destinationInstrumentId) {
    throw new Error("A destination security is required for a merger or demerger.");
  }

  for (const position of positions) {
    const alreadyApplied = await db.prepare(
      "SELECT id FROM corporate_action_applications WHERE corporate_action_id = ? AND portfolio_id = ?",
    ).bind(action.id, position.portfolioId).first();
    if (alreadyApplied) continue;

    const now = Date.now();
    const oldQuantity = Number(position.quantity);
    const oldCost = oldQuantity * Number(position.averagePrice);
    let sourceQuantity = oldQuantity;
    let sourceAverage = Number(position.averagePrice);
    let destinationAdded = 0;
    let destinationCost = 0;
    let cashAmount = 0;

    if (action.actionType === "DIVIDEND") {
      cashAmount = oldQuantity * Number(action.cashPerShare ?? 0);
      if (!(cashAmount > 0)) throw new Error("Dividend cash per share must be positive.");
    } else if (action.actionType === "SPLIT") {
      sourceQuantity = whole(oldQuantity * ratio / base, "The split");
      sourceAverage = sourceQuantity ? oldCost / sourceQuantity : 0;
    } else if (action.actionType === "BONUS") {
      const bonusUnits = whole(oldQuantity * ratio / base, "The bonus issue");
      sourceQuantity = oldQuantity + bonusUnits;
      sourceAverage = sourceQuantity ? oldCost / sourceQuantity : 0;
    } else if (action.actionType === "MERGER") {
      destinationAdded = whole(oldQuantity * ratio / base, "The merger");
      destinationCost = oldCost;
      sourceQuantity = 0;
      sourceAverage = 0;
    } else if (action.actionType === "DEMERGER") {
      destinationAdded = whole(oldQuantity * ratio / base, "The demerger");
      const allocation = Number(action.costAllocationPercent ?? 0);
      if (!(allocation > 0 && allocation < 100)) {
        throw new Error("A demerger needs a destination cost allocation between 0% and 100%.");
      }
      destinationCost = oldCost * allocation / 100;
      sourceAverage = oldQuantity ? (oldCost - destinationCost) / oldQuantity : 0;
    }

    const statements: Array<ReturnType<typeof db.prepare>> = [];
    if (sourceQuantity !== oldQuantity || sourceAverage !== Number(position.averagePrice)) {
      statements.push(
        db.prepare(
          "UPDATE positions SET quantity = ?, average_price = ?, updated_at = ? WHERE id = ?",
        ).bind(sourceQuantity, sourceAverage, now, position.id),
      );
    }

    if (destinationAdded > 0 && action.destinationInstrumentId) {
      const destination = await db.prepare(
        `SELECT id, quantity, average_price AS averagePrice, realised_pnl AS realisedPnl
         FROM positions WHERE portfolio_id = ? AND instrument_id = ?`,
      ).bind(position.portfolioId, action.destinationInstrumentId).first<{
        id: number; quantity: number; averagePrice: number; realisedPnl: number;
      }>();
      if (destination) {
        const destinationQuantity = Number(destination.quantity) + destinationAdded;
        const destinationAverage = (
          Number(destination.quantity) * Number(destination.averagePrice) + destinationCost
        ) / destinationQuantity;
        statements.push(
          db.prepare(
            "UPDATE positions SET quantity = ?, average_price = ?, updated_at = ? WHERE id = ?",
          ).bind(destinationQuantity, destinationAverage, now, destination.id),
        );
      } else {
        statements.push(
          db.prepare(
            `INSERT INTO positions (portfolio_id, instrument_id, quantity, average_price, realised_pnl, updated_at)
             VALUES (?, ?, ?, ?, 0, ?)`,
          ).bind(position.portfolioId, action.destinationInstrumentId, destinationAdded, destinationCost / destinationAdded, now),
        );
      }
    }

    if (cashAmount > 0) {
      statements.push(
        db.prepare("UPDATE portfolios SET cash = cash + ? WHERE id = ?").bind(cashAmount, position.portfolioId),
        db.prepare(
          `INSERT INTO cash_ledger (portfolio_id, amount, action, reason, created_by, occurred_at, created_at)
           VALUES (?, ?, 'CORPORATE_ACTION', ?, ?, ?, ?)`,
        ).bind(position.portfolioId, cashAmount, `Dividend from corporate action #${action.id}`, action.createdBy, action.effectiveAt, now),
      );
    }

    statements.push(
      db.prepare(
        `INSERT INTO corporate_action_applications
         (corporate_action_id, portfolio_id, quantity_before, quantity_after,
          destination_quantity_added, cash_amount, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(action.id, position.portfolioId, oldQuantity, sourceQuantity, destinationAdded, cashAmount, now),
    );
    await db.batch(statements);
  }
}

export async function applyCorporateAction(actionId: number) {
  const db = getD1();
  const action = await db.prepare(
    `UPDATE corporate_actions SET status = 'PROCESSING', last_error = NULL
     WHERE id = ? AND status = 'VERIFIED' AND effective_at <= ?
     RETURNING id, instrument_id AS instrumentId, destination_instrument_id AS destinationInstrumentId,
       action_type AS actionType, effective_at AS effectiveAt, ratio_base AS ratioBase,
       ratio_new AS ratioNew, cash_per_share AS cashPerShare,
       cost_allocation_percent AS costAllocationPercent, created_by AS createdBy`,
  ).bind(actionId, Date.now()).first<CorporateActionRow>();
  if (!action) return false;
  try {
    await applyClaimedAction(action);
    await db.prepare(
      "UPDATE corporate_actions SET status = 'APPLIED', applied_at = ?, last_error = NULL WHERE id = ?",
    ).bind(Date.now(), action.id).run();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Corporate action could not be applied.";
    await db.prepare(
      "UPDATE corporate_actions SET status = 'VERIFIED', last_error = ? WHERE id = ?",
    ).bind(message.slice(0, 500), action.id).run();
    throw error;
  }
}

export async function processDueCorporateActions() {
  const due = (
    await getD1().prepare(
      "SELECT id FROM corporate_actions WHERE status = 'VERIFIED' AND effective_at <= ? ORDER BY effective_at, id LIMIT 20",
    ).bind(Date.now()).all<{ id: number }>()
  ).results;
  for (const action of due) {
    try {
      await applyCorporateAction(action.id);
    } catch {
      // The verified action remains visible with its error for administrator correction.
    }
  }
}
