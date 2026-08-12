CREATE TABLE `bank_accounts` (
	`account_id` serial AUTO_INCREMENT NOT NULL,
	`account_number` varchar(50) NOT NULL,
	`bank_name` varchar(100) NOT NULL,
	`account_name` varchar(100),
	`bank_account_type` varchar(100) DEFAULT 'savings',
	`account_email` varchar(255),
	`account_currency` varchar(255),
	`opening_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`user_id` bigint unsigned NOT NULL,
	`updated_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `bank_accounts_account_id` PRIMARY KEY(`account_id`),
	CONSTRAINT `bank_accounts_account_number_unique` UNIQUE(`account_number`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`category_id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`name` varchar(256) NOT NULL,
	`icon` varchar(50),
	`color` varchar(7),
	CONSTRAINT `categories_category_id` PRIMARY KEY(`category_id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`transaction_id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`account_id` bigint unsigned NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`transaction_type` enum('income','expense') NOT NULL,
	`transaction_description` varchar(255),
	`category_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_transaction_id` PRIMARY KEY(`transaction_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`updated_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `users_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_password_unique` UNIQUE(`password`)
);
--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_account_id_bank_accounts_account_id_fk` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts`(`account_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_category_id_categories_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE no action ON UPDATE no action;