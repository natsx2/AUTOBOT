import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "./theme-provider";
import { Bot, Terminal, Gamepad2, Activity, LogIn, Users, Moon, Sun, Menu, X, Clock, Wifi, ExternalLink } from "lucide-react";
import { useHealthCheck } from "@/api/hooks";

export function Layout({ children }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [time, setTime] = useState("");
  const [ping, setPing] = useState(null);

  const { refetch } = useHealthCheck({ query: { refetchInterval: 5000 } });

  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Manila" }));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkPing = async () => {
      const start = Date.now();
      await refetch();
      setPing(Date.now() - start);
    };
    const interval = setInterval(checkPing, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/login", label: "Bot Login", icon: LogIn },
    { href: "/accounts", label: "Accounts", icon: Users },
    { href: "/commands", label: "Commands", icon: Terminal },
    { href: "/games", label: "Games", icon: Gamepad2 },
    { href: "/activity", label: "Activity", icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            data-testid="button-menu"
            className="p-2 -ml-2 rounded-md hover:bg-secondary/80 text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-primary">
            <Bot className="w-6 h-6" />
            <span className="font-bold text-lg hidden sm:inline-block">AutomatedBot</span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span data-testid="text-time">{time} (PHT)</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <Wifi className="w-4 h-4" />
            <span data-testid="text-ping">{ping !== null ? `${ping}ms` : "---"}</span>
          </div>
          <button
            data-testid="button-theme-toggle"
            className="p-2 rounded-md hover:bg-secondary/80 text-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 transition-all"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2 text-primary">
            <Bot className="w-6 h-6" />
            <span className="font-bold text-lg">Menu</span>
          </div>
          <button
            className="p-2 -mr-2 rounded-md hover:bg-secondary/80 text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary/80 text-foreground"}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Developer info in sidebar footer */}
        <div className="p-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Developer</p>
          <a
            href="https://www.facebook.com/notfound500"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Facebook
          </a>
          <a
            href="https://t.me/trciks"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Telegram Channel
          </a>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <footer className="border-t border-border bg-card px-4 sm:px-6 py-3 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>AutomatedBot V3.0 &mdash; Admin UID: <span className="font-mono">61576783743431</span></span>
        <span className="hidden sm:inline">&bull;</span>
        <span className="flex items-center gap-3">
          <a href="https://www.facebook.com/notfound500" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Facebook
          </a>
          <a href="https://t.me/trciks" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Telegram
          </a>
        </span>
      </footer>
    </div>
  );
}
