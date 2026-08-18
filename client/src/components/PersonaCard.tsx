import { Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERSONA_COLOR_VAR, type PersonaSummary } from "@/lib/personas";

interface PersonaCardProps {
  persona: PersonaSummary;
  onStartCall: (persona: PersonaSummary) => void;
}

export function PersonaCard({ persona, onStartCall }: PersonaCardProps) {
  const accent = PERSONA_COLOR_VAR[persona.colorTheme];

  return (
    <Card
      className="flex flex-col gap-4 p-5"
      data-testid={`card-persona-${persona.slug}`}
    >
      <div className="flex items-start gap-3">
        <div
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md"
          style={{ boxShadow: `0 0 0 2px hsl(${accent} / 0.5)` }}
        >
          <img
            src={persona.avatarUrl}
            alt={`${persona.name} 頭像`}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold" data-testid={`text-name-${persona.slug}`}>
              {persona.name}
            </h3>
            <Badge variant="secondary" className="shrink-0">
              {persona.gender === "male" ? "男聲" : "女聲"}
            </Badge>
          </div>
          <p
            className="mt-0.5 text-sm font-medium"
            style={{ color: `hsl(${accent})` }}
            data-testid={`text-tagline-${persona.slug}`}
          >
            {persona.tagline}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-3">{persona.description}</p>

      <Button
        onClick={() => onStartCall(persona)}
        className="mt-auto gap-2"
        data-testid={`button-call-${persona.slug}`}
      >
        <Phone className="h-4 w-4" />
        開始通話測試
      </Button>
    </Card>
  );
}
