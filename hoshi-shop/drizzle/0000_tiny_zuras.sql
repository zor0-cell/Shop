CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`nonce` text NOT NULL,
	`info` text NOT NULL,
	`total` integer NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `request_once` ON `orders` (`uid`,`nonce`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`info` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`hidden` integer NOT NULL,
	`created` integer NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT "available" CHECK(stock>=0)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`pickup` text NOT NULL,
	`fee` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`login` text NOT NULL,
	`name` text NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (`login`);--> statement-breakpoint
CREATE UNIQUE INDEX `single_owner` ON `users` (`role`) WHERE role='seller';