import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { PERSONA_COLOR_VAR, type PersonaSummary, type CallTranscriptLine } from "@/lib/personas";

type Phase = "connecting" | "ringing" | "in-call" | "ended" | "error";

interface CallModalProps {
  persona: PersonaSummary | null;
  onClose: () => void;
}

const PHASE_LABEL: Record<Phase, string> = {
  connecting: "連接緊…",
  ringing: "響緊…",
  "in-call": "通話中",
  ended: "通話已結束",
  error: "連接失敗",
};

export function CallModal({ persona, onClose }: CallModalProps) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [transcript, setTranscript] = useState<CallTranscriptLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mode, setMode] = useState<"live" | "demo" | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<RetellWebClient | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!persona) return;

    let cancelled = false;
    setPhase("connecting");
    setTranscript([]);
    setMuted(false);
    setErrorMessage("");
    setMode(null);

    async function run() {
      try {
        const res = await apiRequest("POST", "/api/call/start", { personaId: persona!.id });
        const data = await res.json();
        if (cancelled) return;
        setMode(data.mode);

        if (data.mode === "live") {
          const client = new RetellWebClient();
          clientRef.current = client;
          client.on("call_started", () => setPhase("in-call"));
          client.on("update", (update: { transcript?: CallTranscriptLine[] }) => {
            if (update.transcript) setTranscript(update.transcript);
          });
          client.on("call_ended", () => setPhase("ended"));
          client.on("error", (err: unknown) => {
            console.error("Retell call error", err);
            setPhase("error");
            setErrorMessage("通話連接發生問題,請稍後再試。");
          });
          setPhase("ringing");
          await client.startCall({ accessToken: data.accessToken });
        } else {
          setPhase("ringing");
          const t1 = setTimeout(() => {
            if (cancelled) return;
            setPhase("in-call");
            const lines: CallTranscriptLine[] = data.transcript || [];
            lines.forEach((line, i) => {
              const t = setTimeout(() => {
                if (cancelled) return;
                setTranscript((prev) => [...prev, line]);
              }, i * 1400);
              timersRef.current.push(t);
            });
            if (audioRef.current) {
              audioRef.current.src = data.audioUrl;
              audioRef.current.play().catch(() => {});
              audioRef.current.onended = () => {
                if (!cancelled) setPhase("ended");
              };
            }
          }, 900);
          timersRef.current.push(t1);
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setPhase("error");
        setErrorMessage("無法開始通話測試,請稍後再試。");
      }
    }

    run();

    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (clientRef.current) {
        clientRef.current.stopCall();
        clientRef.current = null;
      }
    };
  }, [persona]);

  function handleEnd() {
    if (clientRef.current) {
      clientRef.current.stopCall();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPhase("ended");
  }

  function handleToggleMute() {
    const next = !muted;
    setMuted(next);
    if (clientRef.current) {
      if (next) clientRef.current.mute();
      else clientRef.current.unmute();
    }
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  }

  if (!persona) return null;
  const accent = PERSONA_COLOR_VAR[persona.colorTheme];

  return (
    <Dialog open={Boolean(persona)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="modal-call">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img
              src={persona.avatarUrl}
              alt={persona.name}
              className="h-10 w-10 rounded-md object-cover"
              style={{ boxShadow: `0 0 0 2px hsl(${accent} / 0.5)` }}
            />
            <span>{persona.name}</span>
            {mode === "demo" && (
              <Badge variant="secondary" data-testid="badge-demo-mode">
                示範模式
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {phase === "in-call" || phase === "ended" ? (
              <span className="flex items-center gap-1.5">
                {phase === "in-call" && (
                  <span
                    className="live-dot inline-block h-2 w-2 rounded-full bg-destructive"
                    aria-hidden
                  />
                )}
                {PHASE_LABEL[phase]}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {PHASE_LABEL[phase]}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <audio ref={audioRef} className="hidden" data-testid="audio-demo-player" />

        {phase === "error" ? (
          <p className="text-sm text-destructive" data-testid="text-call-error">
            {errorMessage}
          </p>
        ) : (
          <div
            className="flex h-56 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-muted/40 p-3"
            data-testid="container-transcript"
          >
            {transcript.length === 0 ? (
              <p className="m-auto text-sm text-muted-foreground">
                {phase === "connecting" || phase === "ringing" ? "準備緊對話…" : "未有對話紀錄"}
              </p>
            ) : (
              transcript.map((line, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                    line.role === "agent"
                      ? "self-start bg-card text-card-foreground border border-card-border"
                      : "self-end bg-primary text-primary-foreground"
                  }`}
                  data-testid={`text-transcript-line-${i}`}
                >
                  {line.content}
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggleMute}
            disabled={phase !== "in-call"}
            aria-label={muted ? "取消靜音" : "靜音"}
            data-testid="button-toggle-mute"
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={phase === "ended" || phase === "error" ? onClose : handleEnd}
            aria-label="結束通話"
            data-testid="button-end-call"
          >
            {phase === "ended" || phase === "error" ? (
              <Phone className="h-4 w-4" />
            ) : (
              <PhoneOff className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
