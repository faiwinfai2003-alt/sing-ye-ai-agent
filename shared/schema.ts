import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

// A single persona = one Cantonese AI voice agent (male/female, distinct personality)
export const personas = sqliteTable("personas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  gender: text("gender").notNull(), // 'male' | 'female'
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  colorTheme: text("color_theme").notNull(), // 'gold' | 'jade' | 'ember' | 'rose' | 'azure' | 'violet'
  avatarUrl: text("avatar_url").notNull(),
  demoAudioUrl: text("demo_audio_url").notNull(),
  demoLine: text("demo_line").notNull(),
  language: text("language").notNull().default("yue-CN"),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  voiceProvider: text("voice_provider"),
  retellAgentId: text("retell_agent_id"),
  retellLlmId: text("retell_llm_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
});

export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type Persona = typeof personas.$inferSelect;

// Singleton settings row (id = 1) — holds the Retell API key + admin passcode.
// The API key is never returned to the client; only a boolean "configured" flag is.
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  retellApiKey: text("retell_api_key"),
  adminPasscode: text("admin_passcode").notNull().default("888888"),
  outboundFromNumber: text("outbound_from_number"),
  renewalPersonaId: integer("renewal_persona_id"),
  renewalScript: text("renewal_script"),
});

export type Settings = typeof settings.$inferSelect;

export const callLogs = sqliteTable("call_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  retellCallId: text("retell_call_id").unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  expiryDate: text("expiry_date").notNull(),
  monthlyFee: text("monthly_fee").notNull(),
  personaId: integer("persona_id").notNull(),
  status: text("status").notNull().default("queued"),
  outcome: text("outcome").notNull().default("準備撥出"),
  disconnectionReason: text("disconnection_reason"),
  transcript: text("transcript"),
  recordingUrl: text("recording_url"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type CallLog = typeof callLogs.$inferSelect;
