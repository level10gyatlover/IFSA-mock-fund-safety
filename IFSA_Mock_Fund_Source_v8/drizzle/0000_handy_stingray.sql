CREATE TABLE `cash_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`amount` real NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cash_ledger_portfolio_idx` ON `cash_ledger` (`portfolio_id`);--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`yahoo_symbol` text,
	`exchange` text NOT NULL,
	`name` text NOT NULL,
	`asset_type` text NOT NULL,
	`lot_size` integer DEFAULT 1 NOT NULL,
	`margin_percent` real DEFAULT 100 NOT NULL,
	`expiry` integer,
	`strike` real,
	`option_type` text,
	`last_price` real NOT NULL,
	`previous_close` real NOT NULL,
	`price_source` text DEFAULT 'seed' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_symbol_exchange_unique` ON `instruments` (`symbol`,`exchange`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`instrument_id` integer NOT NULL,
	`created_by` integer NOT NULL,
	`side` text NOT NULL,
	`order_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`limit_price` real,
	`trigger_price` real,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`executed_price` real,
	`placed_at` integer NOT NULL,
	`executed_at` integer,
	`is_backdated` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_portfolio_idx` ON `orders` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` integer,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`cash` real DEFAULT 0 NOT NULL,
	`net_contributions` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolios_owner_unique` ON `portfolios` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `portfolios_kind_idx` ON `portfolios` (`kind`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`instrument_id` integer NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`average_price` real DEFAULT 0 NOT NULL,
	`realised_pnl` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_portfolio_instrument_unique` ON `positions` (`portfolio_id`,`instrument_id`);--> statement-breakpoint
CREATE INDEX `positions_portfolio_idx` ON `positions` (`portfolio_id`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`instrument_id` integer NOT NULL,
	`side` text NOT NULL,
	`thesis` text NOT NULL,
	`target_price` real,
	`stop_loss` real,
	`status` text DEFAULT 'NEW' NOT NULL,
	`admin_note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recommendations_status_idx` ON `recommendations` (`status`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`net_worth` real NOT NULL,
	`cash` real NOT NULL,
	`recorded_at` integer NOT NULL,
	`day_key` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_portfolio_day_unique` ON `snapshots` (`portfolio_id`,`day_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);