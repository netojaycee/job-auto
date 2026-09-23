ALTER TABLE "crawl_runs" ADD COLUMN "status" varchar(20) DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "crawl_runs" ADD COLUMN "error_summary" text;