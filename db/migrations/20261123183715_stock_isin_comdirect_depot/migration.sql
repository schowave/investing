ALTER TABLE `portfolios` ADD `comdirect_depot_id` text;--> statement-breakpoint
ALTER TABLE `stocks` ADD `isin` text;--> statement-breakpoint
CREATE INDEX `stocks_isin` ON `stocks` (`isin`);