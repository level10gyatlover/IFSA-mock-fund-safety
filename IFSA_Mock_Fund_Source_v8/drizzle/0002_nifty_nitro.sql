CREATE TABLE `chat_room_meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `chat_room_meta` (`id`, `revision`) VALUES (1, 0);
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `edited_at` integer;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `edited_by` integer;
