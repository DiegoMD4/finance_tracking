ALTER TABLE `transactions` ADD `transaction_currency` varchar(3) DEFAULT 'HNL' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `exchange_rate` decimal(12,6) DEFAULT '1.000000' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `amount_in_default_currency` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `default_currency_at_transaction` varchar(3) DEFAULT 'HNL' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `default_currency` varchar(3) DEFAULT 'HNL';