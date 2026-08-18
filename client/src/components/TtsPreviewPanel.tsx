import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { Volume2, Square, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { PersonaSummary } from "@/lib/personas";

interface TtsPreviewPanelProps {
  personas: PersonaSummary[];
}

type Status = "idle" | "loading" | "speaking";

function pickCantoneseVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((v) => v.lang.toLowerCase() === "zh-hk") ||
    voices.find((v) => v.lang.toLowerCase().startsWith("zh-hk")) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("zh-cn")) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("zh")) ||
    voices[0]
  );
}

export function TtsPreviewPanel({ personas }: TtsPreviewPanelProps) {
  const [personaId, setPersonaId] = useState<string>(personas[0] ? String(personas[0].id) : "");
  const [text, setText] = useState("大家好,歡迎試用廣東話 AI 語音助理。");
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<"live" | "browser-fallback" | null>(null);
  const [error, setError] = useState("");

  const clientRef = useRef<RetellWebClient | null>(null);

  useEffect(() => {
    if (personas.length > 0 && !personaId) {
      setPersonaId(String(personas[0].id));
    }
  }, [personas, personaId]);

  useEffect(() => {
    return () => {
      clientRef.current?.stopCall();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function handlePlay() {
    if (!personaId || !text.trim()) return;
    setStatus("loading");
    setError("");
    setMode(null);

    try {
      const res = await apiRequest("POST", "/api/tts/preview", {
        personaId: Number(personaId),
        text: text.trim(),
      });
      const data = await res.json();
      setMode(data.mode);

      if (data.mode === "live") {
        const client = new RetellWebClient();
        clientRef.current = client;
        client.on("call_started", () => setStatus("speaking"));
        client.on("call_ended", () => {
          setStatus("idle");
          clientRef.current = null;
        });
        client.on("error", () => {
          setError("試聽播放失敗,請稍後再試。");
          setStatus("idle");
        });
        await client.startCall({ accessToken: data.accessToken });
      } else {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          setError("此瀏覽器唔支援語音合成功能。");
          setStatus("idle");
          return;
        }
        const speak = () => {
          const utterance = new SpeechSynthesisUtterance(data.text || text);
          const voices = window.speechSynthesis.getVoices();
          const voice = pickCantoneseVoice(voices);
          if (voice) utterance.voice = voice;
          utterance.lang = voice?.lang || "zh-HK";
          utterance.onstart = () => setStatus("speaking");
          utterance.onend = () => setStatus("idle");
          utterance.onerror = () => {
            setError("瀏覽器語音播放發生問題。");
            setStatus("idle");
          };
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        };
        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = speak;
        } else {
          speak();
        }
      }
    } catch (err) {
      console.error(err);
      setError("試聽發生問題,請稍後再試。");
      setStatus("idle");
    }
  }

  function handleStop() {
    clientRef.current?.stopCall();
    clientRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStatus("idle");
  }

  return (
    <Card className="p-5 sm:p-6" data-testid="card-tts-preview">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">文字試聽</h3>
          <p className="text-sm text-muted-foreground">
            打入廣東話句子,揀選角色聲音,即刻試聽效果。
          </p>
        </div>
        {mode === "browser-fallback" && status !== "idle" && (
          <Badge variant="secondary" data-testid="badge-browser-fallback">
            瀏覽器語音
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Select value={personaId} onValueChange={setPersonaId}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-tts-persona">
            <SelectValue placeholder="選擇角色" />
          </SelectTrigger>
          <SelectContent>
            {personas.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name} · {p.tagline}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="請輸入想聽嘅廣東話句子…"
          className="min-h-24 resize-none"
          data-testid="textarea-tts-text"
        />

        {error && (
          <p className="text-sm text-destructive" data-testid="text-tts-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          {status !== "idle" && (
            <Button
              variant="outline"
              onClick={handleStop}
              className="gap-2"
              data-testid="button-tts-stop"
            >
              <Square className="h-4 w-4" />
              停止
            </Button>
          )}
          <Button
            onClick={handlePlay}
            disabled={status !== "idle" || !text.trim() || !personaId}
            className="gap-2"
            data-testid="button-tts-play"
          >
            {status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "speaking" ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            {status === "loading" ? "準備緊…" : status === "speaking" ? "播放緊…" : "播放"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
