CREATE TABLE `price_failures` (
	`stock_id` text PRIMARY KEY,
	`failed_at` text NOT NULL,
	`attempts` integer NOT NULL,
	`error` text NOT NULL,
	CONSTRAINT `fk_price_failures_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
