import { useState } from "react";
import {
  useGetBotAccounts, useBotLogout,
  useGetBotCommands, useGetAccountCommands, useUpdateAccountCommands, QK
} from "@/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Activity, Hash, Clock, Terminal, Settings, X, Check, ChevronRight, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";

const formatUptime = (s) =>
  `${Math.floor(s / 3600).toString().padStart(2, "0")}:${Math.floor((s % 3600) / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

function CommandConfigurator({ userid, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allCmds, isLoading: loadingAll } = useGetBotCommands();
  const { data: enabled, isLoading: loadingEnabled } = useGetAccountCommands(userid);
  const updateMutation = useUpdateAccountCommands();

  const [selected, setSelected] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState(null);

  const isLoading = loadingAll || loadingEnabled;

  if (!isLoading && selected === null) {
    setSelected(enabled?.commands || []);
    setSelectedEvents(enabled?.handleEvent || []);
  }

  const toggleCmd = (name) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const toggleEvent = (name) => {
    setSelectedEvents((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const selectAllCmds = () => setSelected((allCmds?.commands || []).map((c) => c));
  const clearAllCmds = () => setSelected([]);

  const handleSave = () => {
    updateMutation.mutate(
      { userid, commands: selected || [], handleEvent: selectedEvents || [] },
      {
        onSuccess: () => {
          toast({ title: "Commands Updated", description: "Active command list saved and applied immediately." });
          queryClient.invalidateQueries({ queryKey: QK.accountCommands(userid) });
          onClose();
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Save Failed", description: err.message || "Could not update commands." });
        },
      }
    );
  };

  return (
    <div className="border border-border rounded-xl bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Configure Active Commands</span>
          <Badge variant="secondary" className="text-xs">{userid}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Commands ({selected?.length || 0}/{allCmds?.commands?.length || 0} enabled)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllCmds}>Select All</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearAllCmds}>Clear All</Button>
              </div>
            </div>
            <ScrollArea className="h-48 rounded-md border border-border bg-secondary/20 p-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(allCmds?.commandDetails || allCmds?.commands?.map((c) => ({ name: c, description: "" })) || []).map((cmd) => (
                  <div key={cmd.name} className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary/40 transition-colors">
                    <Checkbox
                      id={`cfg-cmd-${userid}-${cmd.name}`}
                      checked={selected?.includes(cmd.name) || false}
                      onCheckedChange={() => toggleCmd(cmd.name)}
                      className="mt-0.5"
                    />
                    <label htmlFor={`cfg-cmd-${userid}-${cmd.name}`} className="cursor-pointer flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <Terminal className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{cmd.name}</span>
                      </span>
                      {cmd.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">{cmd.description}</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {allCmds?.handleEvent?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Event Handlers ({selectedEvents?.length || 0}/{allCmds?.handleEvent?.length || 0} enabled)
              </p>
              <div className="flex flex-wrap gap-2">
                {allCmds.handleEvent.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEvent(ev)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedEvents?.includes(ev)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/40 text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              <Check className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save & Apply"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function LogoutDialog({ account, onConfirm, onCancel, isPending }) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="border border-destructive/40 rounded-xl bg-destructive/5 p-4 space-y-3 mt-2">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-semibold">Confirm Logout — {account.name}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        This bot is protected with an access key. Enter the key to proceed.
      </p>
      <div className="space-y-1">
        <Label htmlFor={`logout-key-${account.userid}`} className="text-xs flex items-center gap-1">
          <Lock className="w-3 h-3" /> Access Key
        </Label>
        <div className="relative">
          <Input
            id={`logout-key-${account.userid}`}
            type={showKey ? "text" : "password"}
            placeholder="Enter access key..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="pr-10 h-8 text-sm"
            onKeyDown={(e) => e.key === "Enter" && key.trim() && onConfirm(key.trim())}
            autoFocus
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onConfirm(key.trim())}
          disabled={isPending || !key.trim()}
        >
          <LogOut className="w-3 h-3 mr-1" />
          {isPending ? "Logging out..." : "Confirm Logout"}
        </Button>
      </div>
    </div>
  );
}

export default function Accounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configuringAccount, setConfiguringAccount] = useState(null);
  const [logoutPromptAccount, setLogoutPromptAccount] = useState(null);

  const { data: accounts, isLoading } = useGetBotAccounts({ query: { refetchInterval: 5000 } });
  const logoutMutation = useBotLogout();

  const handleLogout = (userid, accessKey) => {
    logoutMutation.mutate({ userid, accessKey }, {
      onSuccess: () => {
        toast({ title: "Logged Out", description: "Bot session terminated successfully." });
        queryClient.invalidateQueries({ queryKey: QK.accounts() });
        queryClient.invalidateQueries({ queryKey: QK.stats() });
        if (configuringAccount === userid) setConfiguringAccount(null);
        setLogoutPromptAccount(null);
      },
      onError: (err) => {
        const code = err?.code || "";
        if (code === "ACCESS_KEY_REQUIRED") {
          toast({ variant: "destructive", title: "Key Required", description: "This bot requires an access key to logout." });
        } else if (code === "INVALID_ACCESS_KEY") {
          toast({ variant: "destructive", title: "Wrong Key", description: "The access key you entered is incorrect." });
        } else {
          toast({ variant: "destructive", title: "Logout Failed", description: err.error || "Could not log out the account." });
        }
      },
    });
  };

  const initiateLogout = (acc) => {
    if (acc.hasKey) {
      setLogoutPromptAccount(acc.userid);
    } else {
      handleLogout(acc.userid, undefined);
    }
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
            <Card key={acc.userid} className={`overflow-hidden flex flex-col transition-all ${configuringAccount === acc.userid ? "ring-2 ring-primary/40" : ""}`}>
              <CardHeader className="pb-2 border-b border-border/50 bg-secondary/20">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                    <AvatarImage src={acc.thumbSrc || acc.profileUrl || undefined} alt={acc.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">{acc.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg truncate" title={acc.name}>{acc.name}</h3>
                      {acc.hasKey && (
                        <span title="Protected by access key">
                          <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{acc.userid}</div>
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

              <CardFooter className="pt-0 pb-4 px-4 bg-secondary/10 flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() =>
                    setConfiguringAccount((prev) => (prev === acc.userid ? null : acc.userid))
                  }
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Commands
                  <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${configuringAccount === acc.userid ? "rotate-90" : ""}`} />
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  size="sm"
                  onClick={() => initiateLogout(acc)}
                  disabled={logoutMutation.isPending && logoutPromptAccount !== acc.userid}
                >
                  {acc.hasKey ? <Lock className="w-4 h-4 mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                  Logout Session
                </Button>

                {logoutPromptAccount === acc.userid && (
                  <LogoutDialog
                    account={acc}
                    isPending={logoutMutation.isPending}
                    onConfirm={(key) => handleLogout(acc.userid, key)}
                    onCancel={() => setLogoutPromptAccount(null)}
                  />
                )}
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

      {configuringAccount && (
        <CommandConfigurator
          userid={configuringAccount}
          onClose={() => setConfiguringAccount(null)}
        />
      )}
    </div>
  );
}
