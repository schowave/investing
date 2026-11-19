CREATE TABLE `judgements` (
	`stock_id` text PRIMARY KEY,
	`created_at` text NOT NULL,
	`jev_model` text NOT NULL,
	`research_model` text,
	`research` text,
	`sources` text NOT NULL,
	`proposals` text NOT NULL,
	CONSTRAINT `fk_judgements_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
