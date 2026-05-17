export interface BotAccount {
  userid: string;
  name: string;
  profileUrl: string | null;
  thumbSrc: string | null;
  time: number;
  prefix: string;
  online: boolean;
}

export interface CommandDetail {
  name: string;
  description: string;
  usage: string;
  credits: string;
  role: number;
  cooldown: number;
  aliases: string[];
  hasPrefix: boolean;
  version: string;
  category: string;
  dev: boolean;
}

export interface CommandList {
  commands: string[];
  handleEvent: string[];
  commandDetails: CommandDetail[];
  handleEventDetails: Omit<CommandDetail, "aliases" | "dev">[];
}

export interface AccountCommands {
  commands: string[];
  handleEvent: string[];
}

export function loginAccount(
  state: object[],
  prefix: string,
  admin: string[],
  enableCommands: object[],
  accessKey?: string
): Promise<{ userid: string; name: string; profileUrl: string; thumbSrc: string }>;

export function logoutAccount(userid: string, accessKey?: string): Promise<void>;
export function getAccounts(): BotAccount[];
export function getAccount(userid: string): BotAccount | null;
export function getAccountEnabledCommands(userid: string): AccountCommands;
export function updateAccountCommands(userid: string, commands: string[], handleEvent: string[]): void;
export function getCommands(): CommandList;
export function loadCommands(): void;
export function addCustomCommand(name: string, code: string): string;
export function removeCustomCommand(name: string): boolean;
export function getCustomCommands(): string[];
export function restoreSessionsOnStartup(): Promise<void>;
