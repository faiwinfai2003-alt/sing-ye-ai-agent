export interface PersonaSummary {
  id: number;
  slug: string;
  name: string;
  gender: "male" | "female";
  tagline: string;
  description: string;
  colorTheme: "gold" | "azure" | "ember" | "rose" | "violet" | "jade";
  avatarUrl: string;
  demoAudioUrl: string;
  demoLine: string;
  voiceName: string | null;
  voiceProvider: string | null;
  configured: boolean;
}

export const PERSONA_COLOR_VAR: Record<PersonaSummary["colorTheme"], string> = {
  gold: "var(--persona-gold)",
  azure: "var(--persona-azure)",
  ember: "var(--persona-ember)",
  rose: "var(--persona-rose)",
  violet: "var(--persona-violet)",
  jade: "var(--persona-jade)",
};

export interface CallTranscriptLine {
  role: "agent" | "user";
  content: string;
}

export interface CallStartResponse {
  mode: "live" | "demo";
  accessToken?: string;
  callId?: string;
  audioUrl?: string;
  transcript?: CallTranscriptLine[];
}

export interface TtsPreviewResponse {
  mode: "live" | "browser-fallback";
  accessToken?: string;
  callId?: string;
  text?: string;
}

export interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender?: string;
  accent?: string;
  age?: string;
  preview_audio_url?: string;
}
