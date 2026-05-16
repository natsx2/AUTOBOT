import { useGetBotAccounts, useBotLogout, QK } from "@/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Activity, Hash, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formatUptime = (s) =>
  `${Math.floor(s / 3600).toString().padStart(2, "0")}:${Math.floor((s % 3600) / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

export default function Accounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useGetBotAccounts({ query: { refetchInterval: 5000 } });
  const logoutMutation = useBotLogout();

  const handleLogout = (userid) => {
    logoutMutation.mutate({ userid }, {
      onSuccess: () => {
        toast({ title: "Logged Out", description: "Bot session terminated successfully." });
        queryClient.invalidateQueries({ queryKey: QK.accounts() });
        queryClient.invalidateQueries({ queryKey: QK.stats() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Logout Failed", description: err.error || "Could not log out the account." });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Active Accounts</h1>
        <Badge variant="outline" className="px-3 py-1">
          {isLoading ? <Skeleton className="h-4 w-4 mr-2 inline-block" /> : accounts?.length || 0} Online
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : accounts?.length ? (
          accounts.map((acc) => (
            <Card key={acc.userid} className="overflow-hidden flex flex-col">
              <CardHeader className="pb-2 border-b border-border/50 bg-secondary/20">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                    <AvatarImage src={acc.thumbSrc || acc.profileUrl || undefined} alt={acc.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">{acc.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate" title={acc.name}>{acc.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                      <span className="truncate">{acc.userid}</span>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="py-4 flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Prefix</span>
                    <span className="font-mono text-sm bg-secondary px-2 py-1 rounded-md w-fit">{acc.prefix}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Uptime</span>
                    <span className="font-mono text-sm">{formatUptime(acc.time)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 pb-4 px-4 bg-secondary/10">
                <Button
                  variant="destructive"
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => handleLogout(acc.userid)}
                  disabled={logoutMutation.isPending}
                  data-testid={`button-logout-${acc.userid}`}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout Session
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg bg-card/50">
            <Activity className="h-12 w-12 mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground">No accounts online</h3>
            <p className="text-sm mt-1">Connect a bot account from the login page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
