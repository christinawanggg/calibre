CREATE TABLE "player_backgrounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"background" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"wpr_rating" numeric(6, 2),
	"confidence" text NOT NULL,
	"directional" text,
	"trajectory" text,
	"estimate_low" numeric(6, 2),
	"estimate_high" numeric(6, 2),
	"reasoning" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dossier" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wpr_id" text NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_wpr_id_unique" UNIQUE("wpr_id")
);
--> statement-breakpoint
ALTER TABLE "player_backgrounds" ADD CONSTRAINT "player_backgrounds_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;