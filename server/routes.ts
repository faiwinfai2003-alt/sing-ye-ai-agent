import type { Express, Request, Response } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";

const RETELL_BASE = "https://api.retellai.com";

async function retellFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${RETELL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function requirePasscode(req: Request, res: Response): Promise<boolean> {
  const passcode = (req.header("x-admin-passcode") || req.body?.passcode || "").toString();
  const settings = await storage.getSettings();
  if (!passcode || passcode !== settings.adminPasscode) {
    res.status(401).json({ message: "密碼錯誤,請重新輸入管理密碼。" });
    return false;
  }
  return true;
}

function buildGeneralPrompt(name: string, systemPrompt: string) {
  return `${systemPrompt}

【朗讀模式指示】
如果系統提供咗一個叫 preview_text 嘅動態變數,而且內容唔係空白,你嘅唯一任務就係一字不漏、用自然嘅廣東話語調讀出 {{preview_text}} 嘅內容,讀完之後有禮貌咁講一句「多謝收聽,再見」,然後結束通話。唔好加任何解釋或者評論。
如果 preview_text 係空白,即係代表呢個係普通對話通話,你就用返你「${name}」呢個角色嘅性格,主動打招呼、自我介紹,然後同用戶正常對話。`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ---------- Public ----------

  app.get("/api/personas", async (_req, res) => {
    const list = await storage.listPersonas();
    // never leak retell ids that aren't needed by the public client, but harmless — keep response lean
    const sanitized = list.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      gender: p.gender,
      tagline: p.tagline,
      description: p.description,
      colorTheme: p.colorTheme,
      avatarUrl: p.avatarUrl,
      demoAudioUrl: p.demoAudioUrl,
      demoLine: p.demoLine,
      voiceName: p.voiceName,
      voiceProvider: p.voiceProvider,
      configured: Boolean(p.retellAgentId),
    }));
    res.json(sanitized);
  });

  app.get("/api/settings/status", async (_req, res) => {
    const settings = await storage.getSettings();
    res.json({ hasApiKey: Boolean(settings.retellApiKey) });
  });

  app.post("/api/settings/unlock", async (req, res) => {
    const passcode = (req.body?.passcode || "").toString();
    const settings = await storage.getSettings();
    if (!passcode || passcode !== settings.adminPasscode) {
      return res.status(401).json({ message: "密碼錯誤,請重新輸入。" });
    }
    res.json({ ok: true, hasApiKey: Boolean(settings.retellApiKey) });
  });

  app.post("/api/settings/passcode", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const newPasscode = (req.body?.newPasscode || "").toString().trim();
    if (!newPasscode || newPasscode.length < 4) {
      return res.status(400).json({ message: "新密碼太短,至少4個字元。" });
    }
    await storage.setPasscode(newPasscode);
    res.json({ ok: true });
  });

  // ---------- Passcode-gated settings ----------

  app.post("/api/settings/api-key", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const apiKey = (req.body?.apiKey || "").toString().trim();
    if (!apiKey) {
      await storage.setApiKey(null);
      return res.json({ ok: true, hasApiKey: false });
    }
    const check = await retellFetch(apiKey, "/list-voices");
    if (!check.ok) {
      return res.status(400).json({
        message: "Retell API Key 驗證失敗,請檢查Key是否正確。",
        detail: check.json,
      });
    }
    await storage.setApiKey(apiKey);
    res.json({ ok: true, hasApiKey: true });
  });

  app.post("/api/settings/voices", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const settings = await storage.getSettings();
    if (!settings.retellApiKey) {
      return res.status(400).json({ message: "尚未設定 Retell API Key。" });
    }
    const result = await retellFetch(settings.retellApiKey, "/list-voices");
    if (!result.ok) {
      return res.status(result.status).json({ message: "取得聲線列表失敗。", detail: result.json });
    }
    res.json(result.json);
  });

  app.post("/api/settings/persona/:id", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const id = Number(req.params.id);
    const persona = await storage.getPersona(id);
    if (!persona) return res.status(404).json({ message: "找不到呢個角色。" });

    const { voiceId, voiceName, voiceProvider, systemPrompt } = req.body || {};
    const patch: Record<string, any> = {};
    if (voiceId) patch.voiceId = voiceId;
    if (voiceName) patch.voiceName = voiceName;
    if (voiceProvider) patch.voiceProvider = voiceProvider;
    if (systemPrompt) patch.systemPrompt = systemPrompt;

    const settings = await storage.getSettings();
    if (settings.retellApiKey && voiceId) {
      const promptToUse = systemPrompt || persona.systemPrompt;
      const generalPrompt = buildGeneralPrompt(persona.name, promptToUse);
      const llmBody = {
        general_prompt: generalPrompt,
        begin_message: null,
        default_dynamic_variables: { preview_text: "" },
        general_tools: [
          {
            type: "end_call",
            name: "end_call",
            description: "當用戶想結束通話,或者已經讀完朗讀內容時,結束呢次通話。",
          },
        ],
      };

      let llmId = persona.retellLlmId;
      if (llmId) {
        const upd = await retellFetch(settings.retellApiKey, `/update-retell-llm/${llmId}`, {
          method: "PATCH",
          body: JSON.stringify(llmBody),
        });
        if (!upd.ok) return res.status(upd.status).json({ message: "更新 Retell LLM 失敗。", detail: upd.json });
      } else {
        const created = await retellFetch(settings.retellApiKey, "/create-retell-llm", {
          method: "POST",
          body: JSON.stringify(llmBody),
        });
        if (!created.ok) return res.status(created.status).json({ message: "建立 Retell LLM 失敗。", detail: created.json });
        llmId = created.json.llm_id;
        patch.retellLlmId = llmId;
      }

      const agentBody = {
        agent_name: `${persona.name} - Cantonese Voice Agent`,
        voice_id: voiceId,
        language: "yue-CN",
        response_engine: { type: "retell-llm", llm_id: llmId },
      };

      let agentId = persona.retellAgentId;
      if (agentId) {
        const upd = await retellFetch(settings.retellApiKey, `/update-agent/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify(agentBody),
        });
        if (!upd.ok) return res.status(upd.status).json({ message: "更新 Retell Agent 失敗。", detail: upd.json });
      } else {
        const created = await retellFetch(settings.retellApiKey, "/create-agent", {
          method: "POST",
          body: JSON.stringify(agentBody),
        });
        if (!created.ok) return res.status(created.status).json({ message: "建立 Retell Agent 失敗。", detail: created.json });
        agentId = created.json.agent_id;
        patch.retellAgentId = agentId;
      }
    }

    const updated = await storage.updatePersona(id, patch);
    res.json(updated);
  });

  // ---------- Call + TTS preview ----------

  app.post("/api/call/start", async (req, res) => {
    const personaId = Number(req.body?.personaId);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ message: "找不到呢個角色。" });

    const settings = await storage.getSettings();
    if (settings.retellApiKey && persona.retellAgentId) {
      const result = await retellFetch(settings.retellApiKey, "/v2/create-web-call", {
        method: "POST",
        body: JSON.stringify({ agent_id: persona.retellAgentId }),
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: "建立通話失敗。", detail: result.json });
      }
      return res.json({
        mode: "live",
        accessToken: result.json.access_token,
        callId: result.json.call_id,
      });
    }

    res.json({
      mode: "demo",
      audioUrl: persona.demoAudioUrl,
      transcript: [
        { role: "agent", content: persona.demoLine },
        { role: "agent", content: "(呢個係示範模式,實際對話功能需要喺 Settings 設定 Retell API Key 之後先可以使用。)" },
      ],
    });
  });

  app.post("/api/tts/preview", async (req, res) => {
    const personaId = Number(req.body?.personaId);
    const text = (req.body?.text || "").toString().trim();
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ message: "找不到呢個角色。" });
    if (!text) return res.status(400).json({ message: "請輸入文字。" });

    const settings = await storage.getSettings();
    if (settings.retellApiKey && persona.retellAgentId) {
      const result = await retellFetch(settings.retellApiKey, "/v2/create-web-call", {
        method: "POST",
        body: JSON.stringify({
          agent_id: persona.retellAgentId,
          retell_llm_dynamic_variables: { preview_text: text },
        }),
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: "建立試聽通話失敗。", detail: result.json });
      }
      return res.json({
        mode: "live",
        accessToken: result.json.access_token,
        callId: result.json.call_id,
      });
    }

    res.json({ mode: "browser-fallback", text });
  });

  return httpServer;
}
