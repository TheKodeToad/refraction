import { Client, Guild, BaseMessageOptions, User, TextBasedChannel, Message, GuildMember, APIGuildMember } from "discord.js";

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  primaryFlag?: Flag;
  flags?: Flag[];
  deferred?: boolean;
  execute(context: CommandContext, args: CommandArgs): Promise<void>;
}

export interface Flag {
  name: string;
  description: string;
  aliases?: string[];
  required?: boolean;
  type: FlagType;
}

export enum FlagType {
  STRING,
  NUMBER,
  USER,
  ROLE,
  CHANNEL,
  VOID
}

export interface CommandContext {
  user: User;
  member: GuildMember | null;
  channel: TextBasedChannel;
  guild: Guild | null;
  client: Client;
  message: Message<boolean> | null;

  reply(message: string | BaseMessageOptions): Promise<void>;
}

export type CommandArgs = Record<string, any>;

export function defineCommand(command: Command) {
  return command;
}