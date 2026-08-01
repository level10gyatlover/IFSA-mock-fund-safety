CREATE TABLE `corporate_action_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`corporate_action_id` integer NOT NULL,
	`portfolio_id` integer NOT NULL,
	`quantity_before` integer DEFAULT 0 NOT NULL,
	`quantity_after` integer DEFAULT 0 NOT NULL,
	`destination_quantity_added` integer DEFAULT 0 NOT NULL,
	`cash_amount` real DEFAULT 0 NOT NULL,
	`applied_at` integer NOT NULL,
	FOREIGN KEY (`corporate_action_id`) REFERENCES `corporate_actions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `corporate_action_portfolio_unique` ON `corporate_action_applications` (`corporate_action_id`,`portfolio_id`);--> statement-breakpoint
CREATE INDEX `corporate_action_applications_portfolio_idx` ON `corporate_action_applications` (`portfolio_id`);--> statement-breakpoint
CREATE TABLE `corporate_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` integer NOT NULL,
	`destination_instrument_id` integer,
	`action_type` text NOT NULL,
	`effective_at` integer NOT NULL,
	`ratio_base` real,
	`ratio_new` real,
	`cash_per_share` real,
	`cost_allocation_percent` real,
	`source_url` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'VERIFIED' NOT NULL,
	`last_error` text,
	`created_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	`applied_at` integer,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `corporate_actions_due_idx` ON `corporate_actions` (`status`,`effective_at`);--> statement-breakpoint
CREATE INDEX `corporate_actions_instrument_idx` ON `corporate_actions` (`instrument_id`);--> statement-breakpoint
CREATE TABLE `learning_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`module_key` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`quiz_score` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_user_module_unique` ON `learning_progress` (`user_id`,`module_key`);--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`instrument_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_user_instrument_unique` ON `watchlist_items` (`user_id`,`instrument_id`);--> statement-breakpoint
CREATE INDEX `watchlist_user_order_idx` ON `watchlist_items` (`user_id`,`sort_order`);