CREATE TABLE `forward_log` (
	`date` text NOT NULL,
	`arm` text NOT NULL,
	`profile` text NOT NULL,
	`stock_id` text NOT NULL,
	`weight` real NOT NULL,
	`inner_return` real NOT NULL,
	`risk_score` real NOT NULL,
	`price_eur` real NOT NULL,
	`calc_version` integer NOT NULL,
	CONSTRAINT `forward_log_pk` PRIMARY KEY(`date`, `arm`, `profile`, `stock_id`),
	CONSTRAINT `fk_forward_log_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
