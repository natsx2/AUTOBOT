import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useBotLogin, useGetBotCommands, getGetBotAccountsQueryKey, getGetBotStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LogIn, Terminal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

const loginSchema = z.object({
  appstate: z.string().min(1, "Appstate is required"),
  prefix: z.string().min(1, "Prefix is required").max(5),
  admin: z.string().optional(),
  commands: z.array(z.string()).default([]),
});

export default function Login() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: commandsData, isLoading: commandsLoading } = useGetBotCommands();
  const loginMutation = useBotLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      appstate: "",
      prefix: "!",
      admin: "",
      commands: [],
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      // Basic JSON validation
      let parsedState = [];
      try {
        parsedState = JSON.parse(values.appstate);
        if (!Array.isArray(parsedState)) {
          throw new Error("Appstate must be a JSON array");
        }
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Invalid Appstate",
          description: "Please provide valid JSON appstate format.",
        });
        return;
      }

      loginMutation.mutate({
        data: {
          state: parsedState,
          prefix: values.prefix,
          admin: values.admin || undefined,
          commands: values.commands.map(c => ({ name: c })) as any,
        }
      }, {
        onSuccess: (res) => {
          if (res.success) {
            toast({
              title: "Login Successful",
              description: res.message,
            });
            queryClient.invalidateQueries({ queryKey: getGetBotAccountsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBotStatsQueryKey() });
            setLocation("/accounts");
          } else {
            toast({
              variant: "destructive",
              title: "Login Failed",
              description: res.message,
            });
          }
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: err.error || "An unexpected error occurred.",
          });
        }
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: err.message,
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Bot Login</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connect Bot Account</CardTitle>
          <CardDescription>
            Provide your Facebook appstate JSON to authenticate a new bot session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="appstate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appstate JSON</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="[{...}]" 
                        className="font-mono h-32 text-xs" 
                        data-testid="input-appstate"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Paste the exported cookies/appstate array here.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Command Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="!" data-testid="input-prefix" {...field} />
                      </FormControl>
                      <FormDescription>Used to trigger bot commands.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="admin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin UID (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="1000..." data-testid="input-admin" {...field} />
                      </FormControl>
                      <FormDescription>Facebook User ID with admin privileges.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-4 block">Enable Commands</Label>
                {commandsLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-6 w-full" />)}
                  </div>
                ) : (
                  <ScrollArea className="h-48 rounded-md border border-border p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {commandsData?.commands.map((cmd) => (
                        <FormField
                          key={cmd}
                          control={form.control}
                          name="commands"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={cmd}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(cmd)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, cmd])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== cmd
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer flex items-center gap-2">
                                  <Terminal className="w-3 h-3 text-muted-foreground" />
                                  {cmd}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
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
                  <>Authenticating...</>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Connect Bot
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
