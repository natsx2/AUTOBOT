import { useGetBotActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Zap, LogIn, LogOut, Terminal, Gamepad2, Info } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'login': return <LogIn className="h-4 w-4" />;
    case 'logout': return <LogOut className="h-4 w-4" />;
    case 'command': return <Terminal className="h-4 w-4" />;
    case 'game': return <Gamepad2 className="h-4 w-4" />;
    case 'system': return <Activity className="h-4 w-4" />;
    default: return <Info className="h-4 w-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'login': return 'text-green-500 bg-green-500/10 border-green-500/20';
    case 'logout': return 'text-red-500 bg-red-500/10 border-red-500/20';
    case 'command': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'game': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
    default: return 'text-primary bg-primary/10 border-primary/20';
  }
};

export default function ActivityLog() {
  const { data: activity, isLoading } = useGetBotActivity({ query: { refetchInterval: 3000 } });

  return (
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground mt-1">Real-time feed of all bot system events</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-muted-foreground">Live Feed</span>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 border-border overflow-hidden">
        <CardHeader className="bg-secondary/30 border-b border-border py-4 shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            System Events
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden relative">
          <ScrollArea className="h-full absolute inset-0">
            {isLoading ? (
              <div className="p-6 space-y-6">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full max-w-[400px]" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity?.length ? (
              <div className="p-6 space-y-6">
                {activity.map((item, i) => (
                  <div key={item.id} className="group relative flex gap-6 pb-6 last:pb-0">
                    {/* Timeline connecting line */}
                    {i !== activity.length - 1 && (
                      <div className="absolute top-10 left-5 -ml-[1px] h-full w-[2px] bg-border group-hover:bg-primary/20 transition-colors" />
                    )}
                    
                    <div className={`relative z-10 shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${getTypeColor(item.type)}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                        <p className="text-sm font-medium leading-tight text-foreground break-words">
                          {item.message}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 flex items-center gap-1.5">
                          <Activity className="h-3 w-3" />
                          {format(new Date(item.timestamp), "HH:mm:ss.SSS")}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 uppercase tracking-wider ${getTypeColor(item.type).split(' ')[0]}`}>
                          {item.type}
                        </Badge>
                        {item.userid && (
                          <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                            {item.userid}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12">
                <Activity className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">No recent activity</h3>
                <p className="text-sm mt-1 text-center">System logs will appear here in real-time.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
