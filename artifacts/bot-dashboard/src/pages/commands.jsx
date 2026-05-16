import { useGetBotCommands } from "@/api/hooks";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Terminal, Zap, Tag, Clock, User, Code2, Hash } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS = { 0: "Everyone", 1: "Admin", 2: "Developer" };
const ROLE_COLORS = {
  0: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  1: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  2: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

function CommandCard({ cmd }) {
  return (
    <Card className="flex flex-col border border-border/60 bg-card/80 hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-mono font-semibold text-sm truncate">
                {cmd.hasPrefix ? "!" : ""}{cmd.name}
              </p>
              <p className="text-xs text-muted-foreground">v{cmd.version}</p>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[cmd.role] ?? ROLE_COLORS[0]}`}>
            {ROLE_LABELS[cmd.role] ?? "Everyone"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
          {cmd.description || "No description provided."}
        </p>
        {cmd.usage && (
          <div className="flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-xs text-muted-foreground truncate">{cmd.usage}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{cmd.cooldown}s</span>
          {cmd.credits && <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{cmd.credits}</span>}
          {cmd.category && cmd.category !== "general" && <span className="flex items-center gap-1"><Tag className="h-3 w-3 shrink-0" />{cmd.category}</span>}
        </div>
        {cmd.aliases && cmd.aliases.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
            {cmd.aliases.map((a) => (
              <span key={a} className="font-mono text-xs bg-secondary/60 rounded px-1.5 py-0.5">{a}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventCard({ evt }) {
  return (
    <Card className="flex flex-col border border-border/60 bg-card/80 hover:border-accent/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-mono font-semibold text-sm truncate">{evt.name}</p>
              <p className="text-xs text-muted-foreground">v{evt.version}</p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">Event</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
          {evt.description || "No description provided."}
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{evt.cooldown}s cooldown</span>
          {evt.credits && <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{evt.credits}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-14" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Commands() {
  const { data, isLoading } = useGetBotCommands();

  const cmdDetails = data?.commandDetails ?? [];
  const evtDetails = data?.handleEventDetails ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commands</h1>
          <p className="text-muted-foreground mt-1">All loaded bot commands and event handlers</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm self-start sm:self-auto">
          {isLoading ? <Skeleton className="h-4 w-8 inline-block" /> : total} Total Modules
        </Badge>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Chat Commands</h2>
          {!isLoading && <Badge variant="outline" className="ml-1">{cmdDetails.length}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Triggered via prefix (e.g. <span className="font-mono bg-secondary/60 px-1 rounded">!help</span>)
        </p>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : cmdDetails.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cmdDetails.map((cmd) => <CommandCard key={cmd.name} cmd={cmd} />)}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No commands loaded. Place <span className="font-mono">.js</span> files in the{" "}
              <span className="font-mono bg-secondary/60 px-1 rounded">bot-commands/</span> directory.
            </CardContent>
          </Card>
        )}
      </section>

      {(isLoading || evtDetails.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-semibold">Event Handlers</h2>
            {!isLoading && <Badge variant="outline" className="ml-1">{evtDetails.length}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground -mt-2">Background listeners — run automatically on incoming messages</p>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(2)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {evtDetails.map((evt) => <EventCard key={evt.name} evt={evt} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
