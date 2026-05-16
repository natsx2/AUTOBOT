import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGames, useCreateGame, useDeleteGame,
  useRegisterForGame, useClaimGameReward, useGetGamePlayers, QK
} from "@/api/hooks";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gamepad2, Plus, Trash2, Users, Award, ChevronDown, ChevronUp, UserPlus, Gift } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Games() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState(null);

  const { data: games, isLoading: gamesLoading } = useGetGames();
  const createGameMut = useCreateGame();
  const deleteGameMut = useDeleteGame();

  const [form, setForm] = useState({ name: "", description: "", reward: "", maxPlayers: "", status: "active" });
  const [formErrors, setFormErrors] = useState({});

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmitCreate = (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.name || form.name.length < 2) errors.name = "Name must be at least 2 characters";
    if (!form.description || form.description.length < 5) errors.description = "Description is required";
    if (!form.reward || form.reward.length < 2) errors.reward = "Reward description is required";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});

    createGameMut.mutate({
      data: {
        name: form.name,
        description: form.description,
        reward: form.reward,
        maxPlayers: form.maxPlayers ? parseInt(form.maxPlayers) : undefined,
        status: form.status,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Game Created", description: `Created game: ${form.name}` });
        queryClient.invalidateQueries({ queryKey: QK.games() });
        setIsAddOpen(false);
        setForm({ name: "", description: "", reward: "", maxPlayers: "", status: "active" });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to create game" });
      },
    });
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this game?")) {
      deleteGameMut.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Game Deleted" });
          queryClient.invalidateQueries({ queryKey: QK.games() });
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Game Manager</h1>
          <p className="text-muted-foreground mt-1">Manage minigames, rewards, and player registrations</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-game" className="self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" /> Add New Game
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Game</DialogTitle>
              <DialogDescription>Configure a new minigame for your bots to run.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitCreate} className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label>Game Name</Label>
                <Input name="name" placeholder="e.g. Daily Lottery" data-testid="input-game-name" value={form.name} onChange={handleFormChange} />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea name="description" placeholder="How it works..." value={form.description} onChange={handleFormChange} />
                {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Reward</Label>
                  <Input name="reward" placeholder="1000 coins" value={form.reward} onChange={handleFormChange} />
                  {formErrors.reward && <p className="text-xs text-destructive">{formErrors.reward}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Max Players (Optional)</Label>
                  <Input name="maxPlayers" type="number" placeholder="Unlimited" value={form.maxPlayers} onChange={handleFormChange} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={createGameMut.isPending} data-testid="button-submit-game">
                  {createGameMut.isPending ? "Creating..." : "Save Game"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {gamesLoading ? (
          [1, 2].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))
        ) : games?.length ? (
          games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isExpanded={expandedGameId === game.id}
              onToggleExpand={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}
              onDelete={() => handleDelete(game.id)}
            />
          ))
        ) : (
          <Card>
            <CardContent className="py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg bg-card/50 m-6">
              <Gamepad2 className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground">No games created</h3>
              <p className="text-sm mt-1">Create a game to start managing players and rewards.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function GameCard({ game, isExpanded, onToggleExpand, onDelete }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: players, isLoading: playersLoading } = useGetGamePlayers(game.id, {
    query: { enabled: isExpanded, queryKey: QK.gamePlayers(game.id) },
  });

  const registerMut = useRegisterForGame();
  const claimMut = useClaimGameReward();

  const [regForm, setRegForm] = useState({ playerId: "", playerName: "" });
  const [claimForm, setClaimForm] = useState({ playerId: "", playerName: "" });

  const onRegister = (e) => {
    e.preventDefault();
    if (!regForm.playerId || !regForm.playerName) return;
    registerMut.mutate({ id: game.id, data: regForm }, {
      onSuccess: () => {
        toast({ title: "Registered Successfully" });
        queryClient.invalidateQueries({ queryKey: QK.gamePlayers(game.id) });
        queryClient.invalidateQueries({ queryKey: QK.games() });
        setRegForm({ playerId: "", playerName: "" });
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.error }),
    });
  };

  const onClaim = (e) => {
    e.preventDefault();
    if (!claimForm.playerId || !claimForm.playerName) return;
    claimMut.mutate({ id: game.id, data: claimForm }, {
      onSuccess: () => {
        toast({ title: "Reward Claimed" });
        queryClient.invalidateQueries({ queryKey: QK.gamePlayers(game.id) });
        queryClient.invalidateQueries({ queryKey: QK.games() });
        setClaimForm({ playerId: "", playerName: "" });
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.error }),
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-secondary/10 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">{game.name}</CardTitle>
            <Badge variant={game.status === "active" ? "default" : "secondary"} className={game.status === "active" ? "bg-green-500 hover:bg-green-600 text-white" : ""}>
              {game.status.toUpperCase()}
            </Badge>
          </div>
          <CardDescription className="mt-2 max-w-2xl">{game.description}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 text-sm text-right">
          <div className="flex items-center gap-2 font-mono bg-primary/10 text-primary px-3 py-1 rounded-md w-fit">
            <Award className="w-4 h-4" />{game.reward}
          </div>
          <div className="text-muted-foreground flex gap-3 text-xs">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {game.registeredCount}{game.maxPlayers ? `/${game.maxPlayers}` : ""} Reg</span>
            <span className="flex items-center gap-1"><Gift className="w-3 h-3" /> {game.claimedCount} Claimed</span>
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <div className="flex border-t border-border">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex-1 rounded-none h-12 justify-center font-normal hover:bg-secondary/50" data-testid={`expand-game-${game.id}`}>
              {isExpanded ? <><ChevronUp className="mr-2 w-4 h-4" /> Hide Players</> : <><ChevronDown className="mr-2 w-4 h-4" /> Manage Players</>}
            </Button>
          </CollapsibleTrigger>
          <Button variant="ghost" className="rounded-none h-12 px-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete} data-testid={`delete-game-${game.id}`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <CollapsibleContent className="border-t border-border bg-card">
          <div className="p-6 grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" /> Manual Registration</h4>
                <form onSubmit={onRegister} className="flex gap-2 items-start">
                  <Input placeholder="Player UID" className="h-9 text-xs" value={regForm.playerId} onChange={(e) => setRegForm((f) => ({ ...f, playerId: e.target.value }))} />
                  <Input placeholder="Player Name" className="h-9 text-xs" value={regForm.playerName} onChange={(e) => setRegForm((f) => ({ ...f, playerName: e.target.value }))} />
                  <Button type="submit" size="sm" disabled={registerMut.isPending} className="shrink-0 h-9">Register</Button>
                </form>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2"><Gift className="w-4 h-4 text-accent" /> Process Claim</h4>
                <form onSubmit={onClaim} className="flex gap-2 items-start">
                  <Input placeholder="Player UID" className="h-9 text-xs" value={claimForm.playerId} onChange={(e) => setClaimForm((f) => ({ ...f, playerId: e.target.value }))} />
                  <Input placeholder="Player Name" className="h-9 text-xs" value={claimForm.playerName} onChange={(e) => setClaimForm((f) => ({ ...f, playerName: e.target.value }))} />
                  <Button type="submit" size="sm" variant="secondary" disabled={claimMut.isPending} className="shrink-0 h-9">Claim</Button>
                </form>
              </div>
            </div>

            <div className="border border-border rounded-md overflow-hidden flex flex-col h-[280px]">
              <div className="bg-secondary/30 p-3 border-b border-border text-sm font-medium">Registered Players</div>
              <ScrollArea className="flex-1">
                {playersLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" />
                  </div>
                ) : players?.length ? (
                  <div className="divide-y divide-border/50">
                    {players.map((p) => (
                      <div key={p.id} className="p-3 text-sm flex items-center justify-between hover:bg-secondary/10">
                        <div>
                          <p className="font-medium">{p.playerName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.playerId}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{format(new Date(p.registeredAt), "MMM d, HH:mm")}</span>
                          {p.claimed ? (
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Claimed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
                    No players registered yet.
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
