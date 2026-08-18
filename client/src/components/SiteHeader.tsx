import { Link, useLocation } from "wouter";
import { Moon, Sun, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/lib/theme";

export function SiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          data-testid="link-home"
          className="flex items-center gap-2 hover-elevate active-elevate-2 rounded-md px-2 py-1.5 -ml-2"
        >
          <Logo className="h-6 w-6 text-primary" />
          <span className="font-semibold tracking-tight text-sm sm:text-base">
            粵語 AI Voice Agent
          </span>
        </Link>

        <nav className="flex items-center gap-1.5">
          <Link href="/settings" data-testid="link-settings">
            <Button
              variant={location === "/settings" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              data-testid="button-nav-settings"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="切換淺色/深色主題"
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </nav>
      </div>
    </header>
  );
}
