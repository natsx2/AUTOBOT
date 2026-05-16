import { useState } from "react";
import { useLocation } from "wouter";
import { useBotLogin, useGetBotCommands, QK } from "@/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogIn, Terminal } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: commandsData, isLoading: commandsLoading } = useGetBotCommands();
  const loginMutation = useBotLogin();

  const [appstate, setAppstate] = useState("");
  const [prefix, setPrefix] = useState("!");
  const [admin, setAdmin] = useState("");
  const [selectedCmds, setSelectedCmds] = useState([]);
  const [errors, setErrors] = useState({});

  const toggleCmd = (cmd) => {
    setSelectedCmds((prev) =>
      prev.includes(cmd) ? prev.filter((c) => c !== cmd) : [...prev, cmd]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!appstate.trim()) newErrors.appstate = "Appstate is required";
    if (!prefix.trim()) newErrors.prefix = "Prefix is required";
    if (prefix.length > 5) newErrors.prefix = "Prefix too long (max 5)";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    let parsedState;
    try {
      parsedState = JSON.parse(appstate);
      if (!Array.isArray(parsedState)) throw new Error("Must be an array");
    } catch {
      toast({ variant: "destructive", title: "Invalid Appstate", description: "Please provide valid JSON appstate format." });
      return;
    }

    loginMutation.mutate({
      data: {
        state: parsedState,
        prefix,
        admin: admin || undefined,
        // Correct format: [{commands:[...]},{handleEvent:[...]}]
        commands: [{ commands: selectedCmds }, { handleEvent: [] }],
      },
    }, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ title: "Login Successful", description: res.message });
          queryClient.invalidateQueries({ queryKey: QK.accounts() });
          queryClient.invalidateQueries({ queryKey: QK.stats() });
          setLocation("/accounts");
        } else {
          toast({ variant: "destructive", title: "Login Failed", description: res.message });
        }
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error", description: err.error || "An unexpected error occurred." });
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Bot Login</h1>

      <Card>
        <CardHeader>
          <CardTitle>Connect Bot Account</CardTitle>
          <CardDescription>Provide your Facebook appstate JSON to authenticate a new bot session.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="appstate">Appstate JSON</Label>
              <Textarea
                id="appstate"
                placeholder="[{...}]"
                className="font-mono h-32 text-xs"
                data-testid="input-appstate"
                value={appstate}
                onChange={(e) => setAppstate(e.target.value)}
              />
              {errors.appstate && <p className="text-sm text-destructive">{errors.appstate}</p>}
              <p className="text-xs text-muted-foreground">Paste the exported cookies/appstate array here.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="prefix">Command Prefix</Label>
                <Input
                  id="prefix"
                  placeholder="!"
                  data-testid="input-prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                />
                {errors.prefix && <p className="text-sm text-destructive">{errors.prefix}</p>}
                <p className="text-xs text-muted-foreground">Used to trigger bot commands.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin">Admin UID (Optional)</Label>
                <Input
                  id="admin"
                  placeholder="1000..."
                  data-testid="input-admin"
                  value={admin}
                  onChange={(e) => setAdmin(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Facebook User ID with admin privileges.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Enable Commands</Label>
              {commandsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
              ) : (
                <ScrollArea className="h-48 rounded-md border border-border p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {commandsData?.commands.map((cmd) => (
                      <div key={cmd} className="flex flex-row items-center space-x-3">
                        <Checkbox
                          id={`cmd-${cmd}`}
                          checked={selectedCmds.includes(cmd)}
                          onCheckedChange={() => toggleCmd(cmd)}
                        />
                        <label
                          htmlFor={`cmd-${cmd}`}
                          className="font-normal text-sm cursor-pointer flex items-center gap-2"
                        >
                          <Terminal className="w-3 h-3 text-muted-foreground" />
                          {cmd}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                "Authenticating..."
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Connect Bot
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
