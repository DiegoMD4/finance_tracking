ALTER TABLE `transactions` ADD `dedupe_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `transactions` ADD `dedupe_occurrence` smallint unsigned DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_dedupe_unique` UNIQUE(`account_id`,`dedupe_hash`,`dedupe_occurrence`);--> statement-breakpoint
CREATE INDEX `transactions_account_date_idx` ON `transactions` (`account_id`,`transaction_date`);