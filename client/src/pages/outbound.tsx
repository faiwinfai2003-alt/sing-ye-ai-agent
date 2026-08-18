import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RetellWebClient } from "retell-client-js-sdk";
import {
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Loader2,
  Mic,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Save,
  Settings2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { extractErrorMessage } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { CallTranscriptLine, PersonaSummary } from "@/lib/personas";

interface OutboundConfig {
  outboundFromNumber: string;
  renewalPersonaId: number;
  renewalScript: string;
}

interface RetellPhoneNumber {
  phone_number: string;
  nickname?: string;
  area_code?: number;
}

interface CallLog {
  id: number;
  retellCallId: string | null;
  customerName: string;
  customerPhone: string;
  expiryDate: string;
  monthlyFee: string;
  status: string;
  outcome: string;
  disconnectionReason: string | null;
  transcript: string | null;
  durationMs: number | null;
  createdAt: string;
}

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  通話中: "default",
  通話已結束: "secondary",
  無人接聽: "outline",
  忙線: "outline",
  "留言信箱/自動應答": "outline",
  撥號失敗: "destructive",
};

export default function Outbound() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clientRef = useRef<RetellWebClient | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcode, setPasscode] = useState("");
  const [config, setConfig] = useState<OutboundConfig>({
    outboundFromNumber: "",
    renewalPersonaId: 2,
    renewalScript: "",
  });
  const [phoneNumbers, setPhoneNumbers] = useState<RetellPhoneNumber[]>([]);
  const [customerName, setCustomerName] = useState("陳先生");
  const [customerPhone, setCustomerPhone] = useState("");
  const [expiryDate, setExpiryDate] = useState("2026-08-31");
  const [monthlyFee, setMonthlyFee] = useState("港幣 $188");
  const [testOpen, setTestOpen] = useState(false);
  const [testPhase, setTestPhase] = useState<"idle" | "connecting" | "live" | "ended" | "error">("idle");
  const [testTranscript, setTestTranscript] = useState<CallTranscriptLine[]>([]);

  const { data: personas = [] } = useQuery<PersonaSummary[]>({
    queryKey: ["/api/personas"],
  });

  const { data: callLogs = [], isFetching: logsRefreshing } = useQuery<CallLog[]>({
    queryKey: ["/api/outbound/calls", passcode],
    enabled: unlocked,
    refetchInterval: unlocked ? 5000 : false,
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/outbound/calls", { passcode });
      return response.json();
    },
  });

  const loadConfig = async (adminPasscode: string) => {
    const [configResponse, numbersResponse] = await Promise.all([
      apiRequest("POST", "/api/settings/outbound/config", { passcode: adminPasscode }),
      apiRequest("POST", "/api/settings/phone-numbers", { passcode: adminPasscode }),
    ]);
    const loadedConfig = await configResponse.json();
    const loadedNumbers = await numbersResponse.json();
    setConfig(loadedConfig);
    setPhoneNumbers(loadedNumbers);
  };

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/unlock", { passcode: passcodeInput });
      await response.json();
      await loadConfig(passcodeInput);
    },
    onSuccess: () => {
      setPasscode(passcodeInput);
      setUnlocked(true);
      toast({ description: "外撥中心已解鎖。" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", description: extractErrorMessage(error, "無法解鎖或讀取 Retell 電話號碼。") });
    },
  });

  const refreshNumbersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/phone-numbers", { passcode });
      return response.json();
    },
    onSuccess: (numbers: RetellPhoneNumber[]) => {
      setPhoneNumbers(numbers);
      toast({ description: `已載入 ${numbers.length} 個 Retell 電話號碼。` });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", description: extractErrorMessage(error, "取得電話號碼失敗。") });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/outbound", { passcode, ...config });
      return response.json();
    },
    onSuccess: () => toast({ description: "外撥號碼、Agent 同自動對答腳本已儲存。" }),
    onError: (error: Error) => {
      toast({ variant: "destructive", description: extractErrorMessage(error, "儲存外撥設定失敗。") });
    },
  });

  const outboundMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/outbound/call", {
        passcode,
        customerName,
        customerPhone,
        expiryDate,
        monthlyFee,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ description: "Retell 已開始致電,通話結果會自動更新。" });
      queryClient.invalidateQueries({ queryKey: ["/api/outbound/calls", passcode] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", description: extractErrorMessage(error, "無法開始外撥。") });
      queryClient.invalidateQueries({ queryKey: ["/api/outbound/calls", passcode] });
    },
  });

  const startWebTest = async () => {
    setTestOpen(true);
    setTestPhase("connecting");
    setTestTranscript([]);
    try {
      const response = await apiRequest("POST", "/api/outbound/test-web-call", {
        passcode,
        customerName,
        expiryDate,
        monthlyFee,
      });
      const data = await response.json();
      const client = new RetellWebClient();
      clientRef.current = client;
      client.on("call_started", () => setTestPhase("live"));
      client.on("update", (update: { transcript?: CallTranscriptLine[] }) => {
        if (update.transcript) setTestTranscript(update.transcript);
      });
      client.on("call_ended", () => setTestPhase("ended"));
      client.on("error", () => setTestPhase("error"));
      await client.startCall({ accessToken: data.accessToken });
    } catch (error) {
      setTestPhase("error");
      toast({ variant: "destructive", description: extractErrorMessage(error as Error, "開始網頁對話測試失敗。") });
    }
  };

  const stopWebTest = () => {
    clientRef.current?.stopCall();
    clientRef.current = null;
    setTestPhase("ended");
  };

  useEffect(() => () => {
    clientRef.current?.stopCall();
  }, []);

  if (!unlocked) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
        <PhoneCall className="mb-4 h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold">外撥中心</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          呢度可以設定續費腳本、同 AI 試傾、致電客戶同查看未接聽紀錄。
        </p>
        <div className="mt-6 flex w-full flex-col gap-3">
          <Label htmlFor="outbound-passcode" className="sr-only">管理密碼</Label>
          <Input
            id="outbound-passcode"
            type="password"
            placeholder="輸入管理密碼"
            value={passcodeInput}
            onChange={(event) => setPasscodeInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && unlockMutation.mutate()}
            data-testid="input-outbound-passcode"
          />
          <Button
            onClick={() => unlockMutation.mutate()}
            disabled={!passcodeInput || unlockMutation.isPending}
            data-testid="button-unlock-outbound"
          >
            {unlockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            解鎖外撥中心
          </Button>
        </div>
      </main>
    );
  }

  const selectedPersona = personas.find((persona) => persona.id === Number(config.renewalPersonaId));
  const formReady = Boolean(customerName && customerPhone && expiryDate && monthlyFee);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">續費外撥中心</h1>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Retell 已連接
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            設定腳本、先喺網頁同 AI 試傾,確認後先致電客戶。
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          使用 Agent: <span className="font-medium text-foreground">{selectedPersona?.name || "未選擇"}</span>
        </div>
      </div>

      <Tabs defaultValue="call" className="mt-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="call" className="gap-1.5" data-testid="tab-call">
            <PhoneCall className="h-4 w-4" /> 立即致電
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-1.5" data-testid="tab-script">
            <FileText className="h-4 w-4" /> 腳本設定
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5" data-testid="tab-history">
            <History className="h-4 w-4" /> 通話記錄
          </TabsTrigger>
        </TabsList>

        <TabsContent value="call" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">客戶續費資料</h2>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">客戶稱呼</Label>
                  <Input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} data-testid="input-customer-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">客戶電話(E.164)</Label>
                  <Input id="customer-phone" placeholder="+85291234567" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} data-testid="input-customer-phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry-date">服務到期日</Label>
                  <Input id="expiry-date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} data-testid="input-expiry-date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-fee">續用月費</Label>
                  <Input id="monthly-fee" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} data-testid="input-monthly-fee" />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="gap-2" onClick={startWebTest} data-testid="button-test-renewal">
                  <Mic className="h-4 w-4" />
                  同 AI 試傾
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="gap-2" disabled={!formReady || !config.outboundFromNumber || outboundMutation.isPending} data-testid="button-open-call-confirm">
                      <PhoneCall className="h-4 w-4" />
                      {config.outboundFromNumber ? "直接致電客戶" : "先設定外撥號碼"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確認立即致電?</AlertDialogTitle>
                      <AlertDialogDescription>
                        AI 將由 {config.outboundFromNumber || "尚未設定嘅外撥號碼"} 致電 {customerName} ({customerPhone})。
                        請確認客戶已同意接收呢類服務通知,並遵守適用嘅私隱及電話推廣規則。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>返回檢查</AlertDialogCancel>
                      <AlertDialogAction onClick={() => outboundMutation.mutate()} data-testid="button-confirm-outbound-call">
                        確認致電
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">AI 今次會點講</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <p className="rounded-md bg-muted p-3">
                  「你好 {customerName || "客戶"},我係代表服務團隊致電嘅 AI 客服。想用兩分鐘同你跟進服務續期,而家方唔方便?」
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li>提醒到期日: {expiryDate || "未填寫"}</li>
                  <li>說明月費: {monthlyFee || "未填寫"}</li>
                  <li>客戶續用: 安排付款/續期跟進</li>
                  <li>客戶取消: 確認安排取消並交人工跟進</li>
                  <li>客戶拒絕或要求停止: 立即道歉並結束</li>
                </ul>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="script" className="mt-5">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">自動對答腳本</h2>
              </div>
              <Badge variant="outline">支援 {"{{customer_name}}"} / {"{{expiry_date}}"} / {"{{monthly_fee}}"}</Badge>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>續費 Agent</Label>
                <Select value={String(config.renewalPersonaId)} onValueChange={(value) => setConfig((previous) => ({ ...previous, renewalPersonaId: Number(value) }))}>
                  <SelectTrigger data-testid="select-renewal-persona"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {personas.filter((persona) => persona.configured).map((persona) => (
                      <SelectItem key={persona.id} value={String(persona.id)}>{persona.name} · {persona.tagline}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Retell 外撥號碼</Label>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => refreshNumbersMutation.mutate()} data-testid="button-refresh-phone-numbers">
                    <RefreshCw className="h-3.5 w-3.5" /> 更新
                  </Button>
                </div>
                {phoneNumbers.length > 0 ? (
                  <Select value={config.outboundFromNumber} onValueChange={(value) => setConfig((previous) => ({ ...previous, outboundFromNumber: value }))}>
                    <SelectTrigger data-testid="select-outbound-number"><SelectValue placeholder="揀選 Retell 電話號碼" /></SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((number) => (
                        <SelectItem key={number.phone_number} value={number.phone_number}>
                          {number.phone_number}{number.nickname ? ` · ${number.nickname}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Retell 帳戶暫時未有可用電話號碼。請先喺 Retell 購買或匯入號碼,再按「更新」。
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <Label htmlFor="renewal-script">完整腳本及應對規則</Label>
              <Textarea
                id="renewal-script"
                value={config.renewalScript}
                onChange={(event) => setConfig((previous) => ({ ...previous, renewalScript: event.target.value }))}
                className="min-h-[360px] font-mono text-sm leading-6"
                data-testid="textarea-renewal-script"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button className="gap-2" onClick={() => saveConfigMutation.mutate()} disabled={!config.renewalScript || saveConfigMutation.isPending} data-testid="button-save-outbound-config">
                <Save className="h-4 w-4" /> 儲存並更新 AI
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border p-5">
              <div>
                <h2 className="text-lg font-semibold">外撥結果</h2>
                <p className="mt-1 text-sm text-muted-foreground">每 5 秒自動更新,無人接聽、忙線同留言信箱會保留紀錄。</p>
              </div>
              {logsRefreshing && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {callLogs.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <Clock3 className="h-9 w-9 text-muted-foreground" />
                <h3 className="mt-3 font-medium">未有外撥紀錄</h3>
                <p className="mt-1 text-sm text-muted-foreground">完成第一次客戶致電後,結果會顯示喺呢度。</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {callLogs.map((log) => (
                  <article key={log.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center" data-testid={`row-call-log-${log.id}`}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{log.customerName}</h3>
                        <Badge variant={OUTCOME_VARIANT[log.outcome] || "outline"}>{log.outcome}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {log.customerPhone} · 到期 {log.expiryDate} · {log.monthlyFee}
                      </p>
                      {log.disconnectionReason && (
                        <p className="mt-1 text-xs text-muted-foreground">Retell 原因: {log.disconnectionReason}</p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground md:text-right">
                      <div>{new Date(log.createdAt).toLocaleString("zh-HK")}</div>
                      {log.durationMs ? <div>{Math.round(log.durationMs / 1000)} 秒</div> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={testOpen} onOpenChange={(open) => {
        setTestOpen(open);
        if (!open) stopWebTest();
      }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-renewal-test">
          <DialogHeader>
            <DialogTitle>續費 AI 對話測試</DialogTitle>
            <DialogDescription>
              {testPhase === "connecting" && "連接 Retell 同咪高峰中…"}
              {testPhase === "live" && "通話中,你可以扮客戶同 AI 用廣東話對答。"}
              {testPhase === "ended" && "測試通話已結束。"}
              {testPhase === "error" && "測試連接失敗,請檢查 Retell 設定。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-64 flex-col gap-2 overflow-y-auto rounded-md bg-muted p-3">
            {testTranscript.length === 0 ? (
              <div className="m-auto flex flex-col items-center gap-2 text-sm text-muted-foreground">
                {testPhase === "connecting" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
                等待對話內容…
              </div>
            ) : testTranscript.map((line, index) => (
              <div key={index} className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${line.role === "agent" ? "self-start bg-card" : "self-end bg-primary text-primary-foreground"}`}>
                {line.content}
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <Button variant="destructive" className="gap-2" onClick={stopWebTest} disabled={testPhase === "ended" || testPhase === "error"} data-testid="button-stop-renewal-test">
              <PhoneOff className="h-4 w-4" /> 結束測試
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
