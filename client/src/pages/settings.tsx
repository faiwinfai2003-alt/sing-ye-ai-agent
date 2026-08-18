import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, KeyRound, Mic2, ShieldCheck, RefreshCw, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { extractErrorMessage } from "@/lib/utils";
import type { PersonaSummary, RetellVoice } from "@/lib/personas";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [unlocked, setUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcode, setPasscode] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [voices, setVoices] = useState<RetellVoice[]>([]);
  // Retell's Cantonese (yue-CN) TTS is only reliable on the "platform" and
  // "minimax" voice providers today — surface those first so they're easy
  // to find in a long voice list.
  const sortedVoices = [...voices].sort((a, b) => {
    const aYue = a.provider === "platform" || a.provider === "minimax" ? 0 : 1;
    const bYue = b.provider === "platform" || b.provider === "minimax" ? 0 : 1;
    return aYue - bYue;
  });
  const [selectedVoiceByPersona, setSelectedVoiceByPersona] = useState<Record<number, string>>(
    {}
  );

  const { data: settingsStatus } = useQuery<{ hasApiKey: boolean }>({
    queryKey: ["/api/settings/status"],
  });

  const { data: personas } = useQuery<PersonaSummary[]>({
    queryKey: ["/api/personas"],
    enabled: unlocked,
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/unlock", { passcode: passcodeInput });
      return res.json();
    },
    onSuccess: () => {
      setPasscode(passcodeInput);
      setUnlocked(true);
      toast({ description: "解鎖成功。" });
    },
    onError: () => {
      toast({ variant: "destructive", description: "密碼錯誤,請重新輸入。" });
    },
  });

  const saveApiKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/api-key", {
        passcode,
        apiKey: apiKeyInput,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Retell API Key 已儲存並驗證成功。" });
      setApiKeyInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: extractErrorMessage(err, "儲存失敗,請檢查Key是否正確。") });
    },
  });

  const fetchVoicesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/voices", { passcode });
      return res.json();
    },
    onSuccess: (data: RetellVoice[]) => {
      setVoices(data);
      toast({ description: `已取得 ${data.length} 個聲線。` });
    },
    onError: () => {
      toast({ variant: "destructive", description: "取得聲線列表失敗。" });
    },
  });

  const savePersonaMutation = useMutation({
    mutationFn: async ({ personaId, voice }: { personaId: number; voice: RetellVoice }) => {
      const res = await apiRequest("POST", `/api/settings/persona/${personaId}`, {
        passcode,
        voiceId: voice.voice_id,
        voiceName: voice.voice_name,
        voiceProvider: voice.provider,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "角色 Agent 已建立/更新成功。" });
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: extractErrorMessage(err, "建立/更新 Agent 失敗。") });
    },
  });

  const changePasscodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/passcode", {
        passcode,
        newPasscode,
      });
      return res.json();
    },
    onSuccess: () => {
      setPasscode(newPasscode);
      setNewPasscode("");
      toast({ description: "管理密碼已更新。" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: extractErrorMessage(err, "更新密碼失敗。") });
    },
  });

  if (!unlocked) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold">管理密碼驗證</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          呢頁面用嚟設定 Retell API Key 同角色聲線,需要管理密碼先可以進入。
        </p>
        <div className="mt-6 flex w-full flex-col gap-3">
          <Input
            type="password"
            placeholder="請輸入管理密碼"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlockMutation.mutate()}
            data-testid="input-passcode"
          />
          <Button
            onClick={() => unlockMutation.mutate()}
            disabled={!passcodeInput || unlockMutation.isPending}
            data-testid="button-unlock"
          >
            解鎖
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        設定 Retell API Key、揀選每位角色嘅聲線,同管理密碼。
      </p>

      <Card className="mt-6 p-5 sm:p-6" data-testid="card-api-key">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Retell API Key</h2>
          {settingsStatus?.hasApiKey ? (
            <Badge variant="secondary" className="gap-1" data-testid="badge-key-status">
              <CheckCircle2 className="h-3 w-3" />
              已設定
            </Badge>
          ) : (
            <Badge variant="outline" data-testid="badge-key-status">
              未設定
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="password"
            placeholder="貼上你嘅 Retell API Key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="flex-1"
            data-testid="input-api-key"
          />
          <Button
            onClick={() => saveApiKeyMutation.mutate()}
            disabled={!apiKeyInput || saveApiKeyMutation.isPending}
            data-testid="button-save-api-key"
          >
            儲存並驗證
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Key 只會儲存喺伺服器,唔會傳送去前端。未設定之前,通話同試聽功能會用示範音效代替。
        </p>
      </Card>

      <Card className="mt-6 p-5 sm:p-6" data-testid="card-voices">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mic2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">聲線列表</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fetchVoicesMutation.mutate()}
            disabled={!settingsStatus?.hasApiKey || fetchVoicesMutation.isPending}
            data-testid="button-fetch-voices"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新整理
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {voices.length > 0
            ? `已載入 ${voices.length} 個 Retell 聲線,可以喺下面幫每位角色指派聲音。`
            : "先設定 API Key,再按重新整理載入 Retell 提供嘅聲線列表。"}
        </p>
        {voices.length > 0 && (
          <p className="mt-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            廣東話(yue-CN)語音合成暫時只有 <strong>Retell Platform</strong> 同 <strong>MiniMax</strong>{" "}
            兩個聲音供應商支援,其他供應商(ElevenLabs、OpenAI、Cartesia、Fish Audio)嘅聲線讀廣東話句子可能會唔準或變成其他語言。下面清單已將呢兩類聲線排前並標示
            <Badge variant="secondary" className="ml-1 gap-1 align-middle">
              <CheckCircle2 className="h-3 w-3" />
              廣東話
            </Badge>
            ,建議優先揀選有標示嘅聲線。
          </p>
        )}
      </Card>

      <Card className="mt-6 p-5 sm:p-6" data-testid="card-personas">
        <h2 className="mb-4 text-base font-semibold">角色聲線設定</h2>
        <div className="flex flex-col gap-4">
          {personas?.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-md border border-card-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              data-testid={`row-persona-${p.slug}`}
            >
              <div className="flex items-center gap-3">
                <img src={p.avatarUrl} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{p.name}</span>
                    {p.configured && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Agent 已建立
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.voiceName ? `目前聲線: ${p.voiceName}` : "尚未指派聲線"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedVoiceByPersona[p.id] || ""}
                  onValueChange={(v) =>
                    setSelectedVoiceByPersona((prev) => ({ ...prev, [p.id]: v }))
                  }
                  disabled={voices.length === 0}
                >
                  <SelectTrigger className="w-56" data-testid={`select-voice-${p.slug}`}>
                    <SelectValue placeholder="揀選聲線" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedVoices.map((v) => {
                      const isCantonese = v.provider === "platform" || v.provider === "minimax";
                      return (
                        <SelectItem key={v.voice_id} value={v.voice_id}>
                          {isCantonese ? "\u2705 " : ""}
                          {v.voice_name} ({v.gender || "?"} · {v.provider})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedVoiceByPersona[p.id] || savePersonaMutation.isPending}
                  onClick={() => {
                    const voice = voices.find((v) => v.voice_id === selectedVoiceByPersona[p.id]);
                    if (voice) savePersonaMutation.mutate({ personaId: p.id, voice });
                  }}
                  data-testid={`button-save-persona-${p.slug}`}
                >
                  建立/更新
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-5 sm:p-6" data-testid="card-passcode">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">變更管理密碼</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="password"
            placeholder="輸入新密碼 (至少4個字元)"
            value={newPasscode}
            onChange={(e) => setNewPasscode(e.target.value)}
            className="flex-1"
            data-testid="input-new-passcode"
          />
          <Button
            onClick={() => changePasscodeMutation.mutate()}
            disabled={newPasscode.length < 4 || changePasscodeMutation.isPending}
            data-testid="button-save-passcode"
          >
            更新密碼
          </Button>
        </div>
      </Card>
    </div>
  );
}
