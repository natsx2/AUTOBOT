import { useGetBotStats, useGetBotActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Bot, Gamepad2, Terminal, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

const formatUptime = (s: number) => {
  return `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetBotStats({ query: { refetchInterval: 5000 } });
  const { data: activity, isLoading: activityLoading } = useGetBotActivity({ query: { refetchInterval: 5000 } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {statsLoading ? <Skeleton className="h-8 w-24" /> : stats ? formatUptime(stats.uptime) : "00:00:00"}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts Online</CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.accountsOnline || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commands</CardTitle>
            <Terminal className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalCommands || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Games</CardTitle>
            <Gamepad2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalGames || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full pr-4">
              {activityLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-start gap-4">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-3 w-[100px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activity?.length ? (
                <div className="space-y-4">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 text-sm border-b border-border/50 pb-4 last:border-0 last:pb-0">
                      <div className="mt-0.5 bg-primary/10 p-2 rounded-full text-primary">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{item.message}</p>
                        <div className="flex items-center text-muted-foreground text-xs gap-2">
                          <span className="uppercase font-mono tracking-wider">{item.type}</span>
                          <span>&bull;</span>
                          <span>{format(new Date(item.timestamp), "MMM d, yyyy HH:mm:ss")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
