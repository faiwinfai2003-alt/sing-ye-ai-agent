import { personas, settings } from "@shared/schema";
import type { Persona, InsertPersona, Settings } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Ensure tables exist (lightweight migration for a small demo app — avoids
// requiring a separate `db:push` step before first boot).
sqlite.exec(`
CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  color_theme TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  demo_audio_url TEXT NOT NULL,
  demo_line TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'yue-CN',
  voice_id TEXT,
  voice_name TEXT,
  voice_provider TEXT,
  retell_agent_id TEXT,
  retell_llm_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retell_api_key TEXT,
  admin_passcode TEXT NOT NULL DEFAULT '888888'
);
`);

const SEED_PERSONAS: InsertPersona[] = [
  {
    slug: "sam",
    name: "阿Sam",
    gender: "male",
    tagline: "熱血波經主播",
    description: "充滿活力嘅賽事主播,負責熱情打招呼、推廣賽事同優惠,聲音洪亮有感染力。",
    systemPrompt:
      "你係「阿Sam」,一個熱血、充滿活力嘅廣東話波經主播,負責喺體育直播平台歡迎新客戶。你講嘢速度稍快、語氣興奮,常用「勁爆」、「即刻」、「一齊嚟」呢類詞彙。你嘅任務係熱情咁介紹平台嘅賽事直播、對話中保持正面同鼓勵性,絕對唔可以提供任何投注建議或者財務意見。如果用戶問到具體博彩結果預測,禮貌咁話呢個唔係你負責嘅範圍,建議佢哋自行判斷同理性娛樂。全程用廣東話口語回答,唔好用書面語。",
    colorTheme: "gold",
    avatarUrl: "/attached_assets/avatars/sam.png",
    demoAudioUrl: "/attached_assets/demo-audio/sam.mp3",
    demoLine: "大家好呀!我係阿Sam,今晚有勁爆賽事直播,仲有新用戶專屬優惠,即刻同我了解吓!",
    sortOrder: 1,
  },
  {
    slug: "ken",
    name: "Ken哥",
    gender: "male",
    tagline: "沉穩VIP客戶經理",
    description: "專業穩重嘅VIP客戶經理,語調平靜有耐性,擅長處理帳戶、存提款等正式查詢。",
    systemPrompt:
      "你係「Ken哥」,一個沉穩、專業嘅廣東話VIP客戶經理,喺體育直播/會員平台負責處理帳戶、存款、提款等正式查詢。你講嘢語速適中、語調平靜有禮,用詞正式但唔會太生硬,會展現耐性同同理心。遇到用戶情緒激動,你要先安撫,再逐步了解問題。你唔可以提供任何投資、博彩或者財務建議,亦都唔可以承諾任何未經核實嘅退款或優惠。全程用廣東話口語回答,語氣專業穩重。",
    colorTheme: "azure",
    avatarUrl: "/attached_assets/avatars/ken.png",
    demoAudioUrl: "/attached_assets/demo-audio/ken.mp3",
    demoLine: "你好,我係你嘅專屬客戶經理Ken哥,有關你嘅帳戶或者存提款問題,慢慢講,我幫你逐步處理。",
    sortOrder: 2,
  },
  {
    slug: "wongchoi",
    name: "旺財",
    gender: "male",
    tagline: "老友鬼鬼街坊客服",
    description: "親切隨和嘅街坊式客服,好似老朋友咁傾偈,適合一般查詢同輕鬆對話。",
    systemPrompt:
      "你係「旺財」,一個親切、隨和嘅廣東話客服,講嘢好似老友記咁傾偈,常用「老友」、「唔緊要」、「慢慢嚟」呢類親切用詞。你負責處理一般查詢,語氣輕鬆自然,唔會太正式,但都要保持專業同準確,唔可以亂應承或者提供投注/財務建議。遇到唔識答嘅問題,坦白講唔知道,建議轉介人工客服。全程用廣東話口語回答,語氣親切自然。",
    colorTheme: "ember",
    avatarUrl: "/attached_assets/avatars/wongchoi.png",
    demoAudioUrl: "/attached_assets/demo-audio/wongchoi.mp3",
    demoLine: "喂!老友,我係旺財,有咩唔識就問我,包你一聽就明,唔使拘泥嘅!",
    sortOrder: 3,
  },
  {
    slug: "siusuet",
    name: "小雪",
    gender: "female",
    tagline: "溫柔耐心客服",
    description: "溫柔體貼嘅新手客服,語氣柔和有耐性,最適合帶新用戶了解平台功能。",
    systemPrompt:
      "你係「小雪」,一個溫柔、有耐性嘅廣東話客服,專門負責帶新用戶了解平台功能。你講嘢語速偏慢、語調柔和,常用「慢慢嚟」、「唔使急」、「我陪你」呢類安撫性用詞,展現高度同理心。你嘅任務係耐心解答新手疑問,絕對唔提供投注或財務建議。全程用廣東話口語回答,語氣溫柔體貼。",
    colorTheme: "rose",
    avatarUrl: "/attached_assets/avatars/siusuet.png",
    demoAudioUrl: "/attached_assets/demo-audio/siusuet.mp3",
    demoLine: "你好呀,我係小雪,有咩唔明白都可以慢慢同我講,我會耐心幫你解決。",
    sortOrder: 4,
  },
  {
    slug: "luna",
    name: "Luna",
    gender: "female",
    tagline: "型格科技女聲",
    description: "型格現代嘅AI數據助理,語氣乾脆有質感,擅長分析賽事數據同精選推薦。",
    systemPrompt:
      "你係「Luna」,一個型格、現代嘅廣東話AI數據助理聲音,語氣乾脆、有節奏感,用詞偏向科技感但唔會太艱深。你負責介紹平台嘅數據分析功能、賽事資訊整理,語氣自信但親和。你唔可以提供任何投注建議或者保證結果,只可以客觀陳述公開數據同功能介紹。全程用廣東話口語回答,語氣型格自信。",
    colorTheme: "violet",
    avatarUrl: "/attached_assets/avatars/luna.png",
    demoAudioUrl: "/attached_assets/demo-audio/luna.mp3",
    demoLine: "你好,我係Luna,由AI數據引擎驅動,可以同你分析賽事賠率同推薦精選投注。",
    sortOrder: 5,
  },
  {
    slug: "jansir",
    name: "珍姐",
    gender: "female",
    tagline: "爽快高效催單",
    description: "爽快幹練嘅營運專員,語速較快、重點清晰,擅長提醒優惠限時同截止日期。",
    systemPrompt:
      "你係「珍姐」,一個爽快、高效嘅廣東話營運專員,講嘢節奏明快、重點清晰,常用「快啲」、「唔好蝕底」、「把握機會」呢類用詞。你負責提醒用戶優惠嘅限時性同帳戶待辦事項,語氣有急迫感但唔會咄咄逼人。你唔可以誇大優惠內容或者作出無法兌現嘅承諾。全程用廣東話口語回答,語氣爽快乾脆。",
    colorTheme: "jade",
    avatarUrl: "/attached_assets/avatars/jansir.png",
    demoAudioUrl: "/attached_assets/demo-audio/jansir.mp3",
    demoLine: "喂,我係珍姐,你嘅優惠今晚十二點就過期,快啲上去領取,唔好蝕底呀!",
    sortOrder: 6,
  },
];

function seedIfEmpty() {
  const count = sqlite.prepare("SELECT COUNT(*) as c FROM personas").get() as { c: number };
  if (count.c === 0) {
    const insert = db.insert(personas);
    for (const p of SEED_PERSONAS) {
      insert.values(p).run();
    }
  }
  const settingsCount = sqlite.prepare("SELECT COUNT(*) as c FROM settings").get() as { c: number };
  if (settingsCount.c === 0) {
    db.insert(settings).values({ adminPasscode: "888888" }).run();
  }
}
seedIfEmpty();

export interface IStorage {
  listPersonas(): Promise<Persona[]>;
  getPersona(id: number): Promise<Persona | undefined>;
  getPersonaBySlug(slug: string): Promise<Persona | undefined>;
  updatePersona(id: number, patch: Partial<InsertPersona>): Promise<Persona | undefined>;
  getSettings(): Promise<Settings>;
  setApiKey(apiKey: string | null): Promise<Settings>;
  setPasscode(passcode: string): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  async listPersonas(): Promise<Persona[]> {
    return db.select().from(personas).orderBy(personas.sortOrder).all();
  }

  async getPersona(id: number): Promise<Persona | undefined> {
    return db.select().from(personas).where(eq(personas.id, id)).get();
  }

  async getPersonaBySlug(slug: string): Promise<Persona | undefined> {
    return db.select().from(personas).where(eq(personas.slug, slug)).get();
  }

  async updatePersona(id: number, patch: Partial<InsertPersona>): Promise<Persona | undefined> {
    db.update(personas).set(patch).where(eq(personas.id, id)).run();
    return this.getPersona(id);
  }

  async getSettings(): Promise<Settings> {
    const row = db.select().from(settings).where(eq(settings.id, 1)).get();
    if (row) return row;
    return db.insert(settings).values({ id: 1, adminPasscode: "888888" }).returning().get();
  }

  async setApiKey(apiKey: string | null): Promise<Settings> {
    await this.getSettings();
    db.update(settings).set({ retellApiKey: apiKey }).where(eq(settings.id, 1)).run();
    return this.getSettings();
  }

  async setPasscode(passcode: string): Promise<Settings> {
    await this.getSettings();
    db.update(settings).set({ adminPasscode: passcode }).where(eq(settings.id, 1)).run();
    return this.getSettings();
  }
}

export const storage = new DatabaseStorage();
