CREATE TABLE `forward_ranking` (
	`date` text NOT NULL,
	`arm` text NOT NULL,
	`rank` integer NOT NULL,
	`stock_id` text NOT NULL,
	`inner_return` real NOT NULL,
	`risk_score` real NOT NULL,
	`sector` text NOT NULL,
	`region` text NOT NULL,
	`price_eur` real NOT NULL,
	`calc_version` integer NOT NULL,
	`strategy_version` text NOT NULL,
	CONSTRAINT `forward_ranking_pk` PRIMARY KEY(`date`, `arm`, `stock_id`),
	CONSTRAINT `fk_forward_ranking_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
