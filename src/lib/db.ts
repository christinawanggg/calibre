import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, uuid, text, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";

// ─── Schema ────────────────────────────────────────────────────────────────────

const tstz = (col: string) => timestamp(col, { withTimezone: true });

export const players = pgTable("players", {
  id:        uuid("id").primaryKey().defaultRandom(),
  wprId:     text("wpr_id").unique().notNull(),
  name:      text("name").notNull(),
  gender:    text("gender"),
  photoUrl:  text("photo_url"),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

export const playerRatings = pgTable("player_ratings", {
  id:           uuid("id").primaryKey().defaultRandom(),
  playerId:     uuid("player_id").notNull().references(() => players.id),
  wprRating:    numeric("wpr_rating", { precision: 6, scale: 2 }),
  confidence:   text("confidence").notNull(),
  directional:  text("directional"),
  trajectory:   text("trajectory"),
  estimateLow:  numeric("estimate_low", { precision: 6, scale: 2 }),
  estimateHigh: numeric("estimate_high", { precision: 6, scale: 2 }),
  reasoning:    jsonb("reasoning").$type<string[]>().notNull().default([]),
  dossier:      jsonb("dossier").$type<string[]>().notNull().default([]),
  expiresAt:    tstz("expires_at").notNull(),
  createdAt:    tstz("created_at").notNull().defaultNow(),
});

export const playerBackgrounds = pgTable("player_backgrounds", {
  id:         uuid("id").primaryKey().defaultRandom(),
  playerId:   uuid("player_id").notNull().references(() => players.id),
  background: text("background"),  // NULL = searched, nothing found
  expiresAt:  tstz("expires_at").notNull(),
  createdAt:  tstz("created_at").notNull().defaultNow(),
});

// ─── Client ────────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set in .env");

export const sql = postgres(connectionString, { prepare: false }); // prepare: false required for Supabase pooler
export const db  = drizzle(sql, { schema: { players, playerRatings, playerBackgrounds } });
