import type { Express, Request, Response } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage-memory";

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

【外撥續費模式指示】
如果 call_mode 係 outbound_renewal,你要優先跟從以下續費腳本,並使用系統提供嘅客戶資料自然對答:
客戶稱呼: {{customer_name}}
服務到期日: {{expiry_date}}
每月月費: {{monthly_fee}}
{{renewal_script}}

【朗讀模式指示】
如果系統提供咗一個叫 preview_text 嘅動態變數,而且內容唔係空白,你嘅唯一任務就係一字不漏、用自然嘅廣東話語調讀出 {{preview_text}} 嘅內容,讀完之後有禮貌咁講一句「多謝收聽,再見」,然後結束通話。唔好加任何解釋或者評論。
如果 preview_text 係空白,即係代表呢個係普通對話通話,你就用返你「${name}」呢個角色嘅性格,主動打招呼、自我介紹,然後同用戶正常對話。`;
}

function buildLlmBody(name: string, systemPrompt: string) {
  return {
    general_prompt: buildGeneralPrompt(name, systemPrompt),
    begin_message: null,
    default_dynamic_variables: {
      preview_text: "",
      call_mode: "",
      renewal_script: "",
      customer_name: "客戶",
      expiry_date: "稍後確認",
      monthly_fee: "稍後確認",
    },
    general_tools: [
      {
        type: "end_call",
        name: "end_call",
        description: "當用戶想結束通話、拒絕繼續、要求唔再致電,或者已經完成對話時,有禮貌咁結束通話。",
      },
    ],
  };
}

function getCallOutcome(call: any) {
  const status = (call?.call_status || call?.status || "unknown").toString();
  const reason = (call?.disconnection_reason || call?.end_reason || "").toString();
  const combined = `${status} ${reason}`.toLowerCase();
  if (combined.includes("no_answer") || combined.includes("no-answer")) return "無人接聽";
  if (combined.includes("busy")) return "忙線";
  if (combined.includes("voicemail") || combined.includes("machine")) return "留言信箱/自動應答";
  if (combined.includes("failed") || combined.includes("error")) return "撥號失敗";
  if (status === "ongoing") return "通話中";
  if (status === "registered" || status === "queued") return "撥號中";
  if (status === "ended") return "通話已結束";
  return status === "unknown" ? "等待更新" : status;
}

function toDynamicVariables(input: {
  renewalScript: string;
  customerName: string;
  expiryDate: string;
  monthlyFee: string;
}) {
  return {
    call_mode: "outbound_renewal",
    renewal_script: input.renewalScript,
    customer_name: input.customerName,
    expiry_date: input.expiryDate,
    monthly_fee: input.monthlyFee,
    preview_text: "",
  };
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
      const llmBody = buildLlmBody(persona.name, promptToUse);

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

  app.post("/api/settings/outbound", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const fromNumber = (req.body?.outboundFromNumber || "").toString().trim();
    const renewalPersonaId = Number(req.body?.renewalPersonaId);
    const renewalScript = (req.body?.renewalScript || "").toString().trim();
    if (fromNumber && !/^\+[1-9]\d{7,14}$/.test(fromNumber)) {
      return res.status(400).json({ message: "外撥號碼必須使用 E.164 格式,例如 +85212345678。" });
    }
    if (!renewalPersonaId || !renewalScript) {
      return res.status(400).json({ message: "請選擇 Agent 並填寫續費對答腳本。" });
    }
    const persona = await storage.getPersona(renewalPersonaId);
    if (!persona?.retellLlmId) {
      return res.status(400).json({ message: "所選 Agent 尚未完成 Retell 設定。" });
    }
    const current = await storage.getSettings();
    if (!current.retellApiKey) {
      return res.status(400).json({ message: "尚未設定 Retell API Key。" });
    }
    const update = await retellFetch(current.retellApiKey, `/update-retell-llm/${persona.retellLlmId}`, {
      method: "PATCH",
      body: JSON.stringify(buildLlmBody(persona.name, persona.systemPrompt)),
    });
    if (!update.ok) {
      return res.status(update.status).json({ message: "更新 Retell 對答設定失敗。", detail: update.json });
    }
    await storage.updateOutboundSettings({
      outboundFromNumber: fromNumber || null,
      renewalPersonaId,
      renewalScript,
    });
    res.json({ ok: true });
  });

  app.post("/api/settings/outbound/config", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const current = await storage.getSettings();
    res.json({
      outboundFromNumber: current.outboundFromNumber || "",
      renewalPersonaId: current.renewalPersonaId || 2,
      renewalScript: current.renewalScript || "",
    });
  });

  app.post("/api/settings/phone-numbers", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const current = await storage.getSettings();
    if (!current.retellApiKey) return res.status(400).json({ message: "尚未設定 Retell API Key。" });
    const result = await retellFetch(current.retellApiKey, "/v2/list-phone-numbers?limit=100");
    if (!result.ok) {
      return res.status(result.status).json({ message: "取得 Retell 電話號碼失敗。", detail: result.json });
    }
    const numbers = Array.isArray(result.json)
      ? result.json
      : result.json?.phone_numbers || result.json?.data || [];
    res.json(numbers);
  });

  // ---------- Renewal outbound calling ----------

  app.post("/api/outbound/test-web-call", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const current = await storage.getSettings();
    const persona = await storage.getPersona(Number(current.renewalPersonaId || 2));
    if (!current.retellApiKey || !persona?.retellAgentId || !current.renewalScript) {
      return res.status(400).json({ message: "請先完成 Retell Agent 同續費腳本設定。" });
    }
    const customerName = (req.body?.customerName || "陳先生").toString().trim();
    const expiryDate = (req.body?.expiryDate || "今個月底").toString().trim();
    const monthlyFee = (req.body?.monthlyFee || "港幣一百元").toString().trim();
    const result = await retellFetch(current.retellApiKey, "/v2/create-web-call", {
      method: "POST",
      body: JSON.stringify({
        agent_id: persona.retellAgentId,
        retell_llm_dynamic_variables: toDynamicVariables({
          renewalScript: current.renewalScript,
          customerName,
          expiryDate,
          monthlyFee,
        }),
      }),
    });
    if (!result.ok) {
      return res.status(result.status).json({ message: "建立續費對話測試失敗。", detail: result.json });
    }
    res.json({ mode: "live", accessToken: result.json.access_token, callId: result.json.call_id });
  });

  app.post("/api/outbound/call", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const current = await storage.getSettings();
    const persona = await storage.getPersona(Number(current.renewalPersonaId || 2));
    if (!current.retellApiKey || !persona?.retellAgentId || !current.renewalScript) {
      return res.status(400).json({ message: "請先完成 Retell Agent 同續費腳本設定。" });
    }
    if (!current.outboundFromNumber) {
      return res.status(400).json({ message: "請先喺 Settings 揀選 Retell 外撥號碼。" });
    }
    const customerName = (req.body?.customerName || "").toString().trim();
    const customerPhone = (req.body?.customerPhone || "").toString().trim();
    const expiryDate = (req.body?.expiryDate || "").toString().trim();
    const monthlyFee = (req.body?.monthlyFee || "").toString().trim();
    if (!customerName || !expiryDate || !monthlyFee || !/^\+[1-9]\d{7,14}$/.test(customerPhone)) {
      return res.status(400).json({ message: "請填齊客戶資料,電話要使用 E.164 格式。" });
    }

    const log = await storage.createCallLog({
      customerName,
      customerPhone,
      expiryDate,
      monthlyFee,
      personaId: persona.id,
    });
    const result = await retellFetch(current.retellApiKey, "/v2/create-phone-call", {
      method: "POST",
      body: JSON.stringify({
        from_number: current.outboundFromNumber,
        to_number: customerPhone,
        override_agent_id: persona.retellAgentId,
        metadata: { local_call_log_id: String(log.id), purpose: "service_renewal" },
        retell_llm_dynamic_variables: toDynamicVariables({
          renewalScript: current.renewalScript,
          customerName,
          expiryDate,
          monthlyFee,
        }),
      }),
    });
    if (!result.ok) {
      await storage.updateCallLog(log.id, {
        status: "error",
        outcome: "撥號失敗",
        disconnectionReason: JSON.stringify(result.json || {}),
      });
      return res.status(result.status).json({ message: "Retell 外撥失敗。", detail: result.json });
    }
    const updated = await storage.updateCallLog(log.id, {
      retellCallId: result.json.call_id,
      status: result.json.call_status || "registered",
      outcome: getCallOutcome(result.json),
    });
    res.status(201).json(updated);
  });

  app.post("/api/outbound/calls", async (req, res) => {
    if (!(await requirePasscode(req, res))) return;
    const current = await storage.getSettings();
    let logs = await storage.listCallLogs();
    if (current.retellApiKey) {
      const active = logs.filter((log) =>
        log.retellCallId && ["queued", "registered", "ongoing"].includes(log.status)
      ).slice(0, 10);
      await Promise.all(active.map(async (log) => {
        const result = await retellFetch(current.retellApiKey!, `/v1/get-call/${log.retellCallId}`);
        if (!result.ok) return;
        const call = result.json || {};
        const start = Number(call.start_timestamp || 0);
        const end = Number(call.end_timestamp || 0);
        await storage.updateCallLog(log.id, {
          status: call.call_status || log.status,
          outcome: getCallOutcome(call),
          disconnectionReason: call.disconnection_reason || null,
          transcript: call.transcript || null,
          recordingUrl: call.recording_url || null,
          durationMs: start && end ? Math.max(0, end - start) : null,
        });
      }));
      logs = await storage.listCallLogs();
    }
    res.json(logs);
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
