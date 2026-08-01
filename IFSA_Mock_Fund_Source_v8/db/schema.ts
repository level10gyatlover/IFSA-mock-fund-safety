import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    userId: integer("user_id").notNull().references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const portfolios = sqliteTable(
  "portfolios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerUserId: integer("owner_user_id").references(() => users.id),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["flagship", "member"] }).notNull(),
    cash: real("cash").notNull().default(0),
    netContributions: real("net_contributions").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("portfolios_owner_unique").on(table.ownerUserId),
    index("portfolios_kind_idx").on(table.kind),
  ],
);

export const instruments = sqliteTable(
  "instruments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull(),
    yahooSymbol: text("yahoo_symbol"),
    exchange: text("exchange").notNull(),
    name: text("name").notNull(),
    assetType: text("asset_type").notNull(),
    lotSize: integer("lot_size").notNull().default(1),
    marginPercent: real("margin_percent").notNull().default(100),
    expiry: integer("expiry", { mode: "timestamp_ms" }),
    strike: real("strike"),
    optionType: text("option_type"),
    lastPrice: real("last_price").notNull(),
    previousClose: real("previous_close").notNull(),
    priceSource: text("price_source").notNull().default("seed"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("instruments_symbol_exchange_unique").on(table.symbol, table.exchange)],
);

export const positions = sqliteTable(
  "positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
    instrumentId: integer("instrument_id").notNull().references(() => instruments.id),
    quantity: integer("quantity").notNull().default(0),
    averagePrice: real("average_price").notNull().default(0),
    realisedPnl: real("realised_pnl").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("positions_portfolio_instrument_unique").on(table.portfolioId, table.instrumentId),
    index("positions_portfolio_idx").on(table.portfolioId),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
    instrumentId: integer("instrument_id").notNull().references(() => instruments.id),
    createdBy: integer("created_by").notNull().references(() => users.id),
    side: text("side", { enum: ["BUY", "SELL"] }).notNull(),
    orderType: text("order_type").notNull(),
    quantity: integer("quantity").notNull(),
    limitPrice: real("limit_price"),
    triggerPrice: real("trigger_price"),
    status: text("status").notNull().default("PENDING"),
    executedPrice: real("executed_price"),
    placedAt: integer("placed_at", { mode: "timestamp_ms" }).notNull(),
    executedAt: integer("executed_at", { mode: "timestamp_ms" }),
    isBackdated: integer("is_backdated", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
  },
  (table) => [
    index("orders_portfolio_idx").on(table.portfolioId),
    index("orders_status_idx").on(table.status),
  ],
);

export const cashLedger = sqliteTable(
  "cash_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
    amount: real("amount").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    createdBy: integer("created_by").notNull().references(() => users.id),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("cash_ledger_portfolio_idx").on(table.portfolioId)],
);

export const recommendations = sqliteTable(
  "recommendations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    instrumentId: integer("instrument_id").notNull().references(() => instruments.id),
    side: text("side").notNull(),
    thesis: text("thesis").notNull(),
    targetPrice: real("target_price"),
    stopLoss: real("stop_loss"),
    status: text("status").notNull().default("NEW"),
    adminNote: text("admin_note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("recommendations_status_idx").on(table.status)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    deviceId: text("device_id").notNull(),
    senderName: text("sender_name").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    editedBy: integer("edited_by"),
  },
  (table) => [
    index("chat_messages_created_idx").on(table.createdAt),
    index("chat_messages_user_idx").on(table.userId),
  ],
);

export const chatRoomMeta = sqliteTable("chat_room_meta", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
});

export const watchlistItems = sqliteTable(
  "watchlist_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    instrumentId: integer("instrument_id").notNull().references(() => instruments.id),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("watchlist_user_instrument_unique").on(table.userId, table.instrumentId),
    index("watchlist_user_order_idx").on(table.userId, table.sortOrder),
  ],
);

export const learningProgress = sqliteTable(
  "learning_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    moduleKey: text("module_key").notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    quizScore: integer("quiz_score").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("learning_user_module_unique").on(table.userId, table.moduleKey)],
);

export const corporateActions = sqliteTable(
  "corporate_actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instrumentId: integer("instrument_id").notNull().references(() => instruments.id),
    destinationInstrumentId: integer("destination_instrument_id").references(() => instruments.id),
    actionType: text("action_type", { enum: ["DIVIDEND", "BONUS", "SPLIT", "MERGER", "DEMERGER"] }).notNull(),
    effectiveAt: integer("effective_at", { mode: "timestamp_ms" }).notNull(),
    ratioBase: real("ratio_base"),
    ratioNew: real("ratio_new"),
    cashPerShare: real("cash_per_share"),
    costAllocationPercent: real("cost_allocation_percent"),
    sourceUrl: text("source_url").notNull(),
    notes: text("notes"),
    status: text("status", { enum: ["VERIFIED", "APPLIED"] }).notNull().default("VERIFIED"),
    lastError: text("last_error"),
    createdBy: integer("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("corporate_actions_due_idx").on(table.status, table.effectiveAt),
    index("corporate_actions_instrument_idx").on(table.instrumentId),
  ],
);

export const corporateActionApplications = sqliteTable(
  "corporate_action_applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    corporateActionId: integer("corporate_action_id").notNull().references(() => corporateActions.id),
    portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
    quantityBefore: integer("quantity_before").notNull().default(0),
    quantityAfter: integer("quantity_after").notNull().default(0),
    destinationQuantityAdded: integer("destination_quantity_added").notNull().default(0),
    cashAmount: real("cash_amount").notNull().default(0),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("corporate_action_portfolio_unique").on(table.corporateActionId, table.portfolioId),
    index("corporate_action_applications_portfolio_idx").on(table.portfolioId),
  ],
);

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
    netWorth: real("net_worth").notNull(),
    cash: real("cash").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    dayKey: text("day_key").notNull(),
  },
  (table) => [uniqueIndex("snapshots_portfolio_day_unique").on(table.portfolioId, table.dayKey)],
);
