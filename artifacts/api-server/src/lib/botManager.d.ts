export interface BotAccount {
  userid: string;
  name: string;
  profileUrl: string | null;
  thumbSrc: string | null;
  time: number;
  prefix: string;
  online: boolean;
}

export interface CommandList {
  commands: string[];
  handleEvent: string[];
}

export function loginAccount(
  state: object[],
  prefix: string,
  admin: string[],
  enableCommands: object[]
): Promise<{ userid: string; name: string; profileUrl: string; thumbSrc: string }>;

export function logoutAccount(userid: string): Promise<void>;
export function getAccounts(): BotAccount[];
export function getAccount(userid: string): BotAccount | null;
export function getCommands(): CommandList;
export function loadCommands(): void;
export function restoreSessionsOnStartup(): Promise<void>;
