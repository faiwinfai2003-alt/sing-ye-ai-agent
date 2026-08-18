import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PersonaCard } from "@/components/PersonaCard";
import { CallModal } from "@/components/CallModal";
import { TtsPreviewPanel } from "@/components/TtsPreviewPanel";
import { Skeleton } from "@/components/ui/skeleton";
import type { PersonaSummary } from "@/lib/personas";

export default function Home() {
  const [activePersona, setActivePersona] = useState<PersonaSummary | null>(null);

  const { data: personas, isLoading } = useQuery<PersonaSummary[]>({
    queryKey: ["/api/personas"],
  });

  const { data: settingsStatus } = useQuery<{ hasApiKey: boolean }>({
    queryKey: ["/api/settings/status"],
  });

  return (
    <div className="hero-radial min-h-[calc(100vh-3.5rem)]">
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-medium tracking-wide text-muted-foreground">
            體育直播 · 會員平台專用
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            廣東話 AI Voice Agent 試聽平台
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            揀選一位角色,即刻測試接聽對話,或者打入句子試聽廣東話語音效果。全部聲音同性格由 Retell
            AI 驅動,支援男女聲共 6 款。
          </p>
          {settingsStatus && !settingsStatus.hasApiKey && (
            <p
              className="mt-4 inline-flex rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
              data-testid="text-demo-notice"
            >
              目前未設定 Retell API Key —— 通話同試聽功能會使用示範音效 / 瀏覽器語音代替。前往{" "}
              <span className="mx-1 font-medium text-foreground">Settings</span> 設定即可啟用真實
              AI 語音對話。
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold">揀選你嘅 AI 客服角色</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-md" />
            ))}
          {personas?.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} onStartCall={setActivePersona} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
        {personas && personas.length > 0 && <TtsPreviewPanel personas={personas} />}
      </section>

      <CallModal persona={activePersona} onClose={() => setActivePersona(null)} />
    </div>
  );
}
