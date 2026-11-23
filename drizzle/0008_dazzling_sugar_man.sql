CREATE TABLE `import_batches` (
	`import_batch_id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`account_id` bigint unsigned NOT NULL,
	`file_hash` varchar(64),
	`file_name` varchar(255),
	`file_size` int unsigned,
	`source_format` varchar(16),
	`row_count` int unsigned NOT NULL DEFAULT 0,
	`saved_count` int unsigned NOT NULL DEFAULT 0,
	`skipped_count` int unsigned NOT NULL DEFAULT 0,
	`failed_count` int unsigned NOT NULL DEFAULT 0,
	`undone_at` timestamp,
	`updated_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `import_batches_import_batch_id` PRIMARY KEY(`import_batch_id`)
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `import_batch_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_account_id_bank_accounts_account_id_fk` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts`(`account_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `import_batches_lookup_idx` ON `import_batches` (`account_id`,`file_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `import_batches_user_idx` ON `import_batches` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_import_batch_id_import_batches_import_batch_id_fk` FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`import_batch_id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `transactions_import_batch_idx` ON `transactions` (`import_batch_id`);