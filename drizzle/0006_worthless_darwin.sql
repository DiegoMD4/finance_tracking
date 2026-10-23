CREATE TABLE `currencies` (
	`currency_id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(3) NOT NULL,
	`name` varchar(100) NOT NULL,
	`symbol` varchar(10),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp,
	CONSTRAINT `currencies_currency_id` PRIMARY KEY(`currency_id`),
	CONSTRAINT `currencies_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
INSERT INTO `currencies` (`code`, `name`, `symbol`, `is_active`) VALUES
	('HNL', 'Lempira hondureño', 'L.', true),
	('USD', 'US Dollar', '$', true),
	('EUR', 'Euro', '€', true);
--> statement-breakpoint
-- Estandarizar accountCurrency de texto largo a código ISO antes de reducir la columna
UPDATE `bank_accounts` SET `account_currency` = 'HNL' WHERE `account_currency` = 'Lempiras';
UPDATE `bank_accounts` SET `account_currency` = 'USD' WHERE `account_currency` = 'Dolares';
UPDATE `bank_accounts` SET `account_currency` = 'EUR' WHERE `account_currency` = 'Euros';
--> statement-breakpoint
ALTER TABLE `bank_accounts` MODIFY COLUMN `account_currency` varchar(3);