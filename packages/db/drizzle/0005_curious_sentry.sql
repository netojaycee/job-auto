ALTER TABLE "speculative_applications" ALTER COLUMN "lead_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "application_email" text;--> statement-breakpoint
ALTER TABLE "speculative_applications" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "speculative_applications" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "speculative_applications" ADD COLUMN "context" text;