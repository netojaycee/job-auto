CREATE TABLE "funding_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_feed" varchar(40) NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone,
	"processed" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"domain" text,
	"funding_amount" text,
	"summary" text,
	"guessed_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speculative_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'shortlisted' NOT NULL,
	"match_score" integer,
	"match_reasoning" text,
	"tailored_cv_ref" text,
	"cover_letter_ref" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funding_leads" ADD CONSTRAINT "funding_leads_article_id_funding_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."funding_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speculative_applications" ADD CONSTRAINT "speculative_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speculative_applications" ADD CONSTRAINT "speculative_applications_lead_id_funding_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."funding_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funding_articles_url_idx" ON "funding_articles" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "speculative_applications_user_lead_idx" ON "speculative_applications" USING btree ("user_id","lead_id");