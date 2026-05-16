import { useGetBotCommands } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Terminal, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Commands() {
  const { data: commandsData, isLoading } = useGetBotCommands();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Available Commands</h1>
          <p className="text-muted-foreground mt-1">All loaded bot commands and event handlers</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm self-start sm:self-auto">
          {isLoading ? <Skeleton className="h-4 w-4 mr-2 inline-block" /> : commandsData?.total || 0} Total Modules
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              <CardTitle>Chat Commands</CardTitle>
            </div>
            <CardDescription>Commands triggered via prefix (e.g. !help)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                {[...Array(15)].map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
              </div>
            ) : commandsData?.commands.length ? (
              <div className="flex flex-wrap gap-2">
                {commandsData.commands.map(cmd => (
                  <Badge key={`cmd-${cmd}`} variant="outline" className="px-3 py-1 font-mono text-sm bg-secondary/30">
                    {cmd}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No commands loaded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <CardTitle>Event Handlers</CardTitle>
            </div>
            <CardDescription>Background listeners (e.g. group updates, auto-reply)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-32 rounded-full" />)}
              </div>
            ) : commandsData?.handleEvent.length ? (
              <div className="flex flex-wrap gap-2">
                {commandsData.handleEvent.map(evt => (
                  <Badge key={`evt-${evt}`} variant="secondary" className="px-3 py-1 font-mono text-sm">
                    {evt}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No event handlers loaded.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
