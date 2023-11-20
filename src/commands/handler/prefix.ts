import { Message } from 'discord.js';
import { CommandArgs, CommandContext, Flag, FlagType } from '../types';
import { COMMANDS } from '..';

const SNOWFLAKE = /^[0-9]+$/;

export async function handleMessage(event: Message): Promise<boolean> {
  if (!(event.content.startsWith('!') || event.content.startsWith('r')))
    return false;

  const commandName = event.content.substring(1).split(' ', 1)[0];

  const split = event.content.indexOf(' ');
  const body = split === -1 ? '' : event.content.substring(split + 1);

  const command = COMMANDS.find(
    (cmd) => cmd.name === commandName || cmd.aliases?.includes(commandName)
  );
  if (!command) return false; // to prevent accidental responses, only do so when it's an actual command

  const flags = [
    ...(command.primaryFlag ? [command.primaryFlag] : []),
    ...(command.flags ?? []),
  ];
  const context: CommandContext = {
    guild: event.guild,
    channel: event.channel,
    user: event.author,
    member: event.member,
    client: event.client,
    message: event,
    async reply(message) {
      await event.channel.send(message);
    },
  };

  try {
    const args: CommandArgs = {};
    const parser = new Parser(body, context);

    if (flags.length !== 0) {
      for (const flag of flags)
        args[flag.name] = flag.type === FlagType.VOID ? false : null;

      while (!parser.isEOF()) {
        let flag: Flag;
        if (parser.peekChar() == '-') {
          const flagName = parser.readWord().substring(1);
          const flaggable = flags.find(
            (flag) => flag.name === flagName || flag.aliases?.includes(flagName)
          );
          if (!flaggable) {
            context.reply(`:x: Invalid flag \`${flagName}\``);
            return true;
          }
          flag = flaggable;
        } else {
          const flaggable = command.primaryFlag;
          if (!flaggable || args[flaggable.name]) {
            context.reply(`:x: Expected flag at position ${parser.cursor()}`);
            return true;
          }
          flag = flaggable;
        }

        let value;
        switch (flag.type) {
          case FlagType.STRING:
            value = parser.readString();
            break;
          case FlagType.NUMBER:
            value = parser.readNumber();
            break;
          case FlagType.USER:
            value = parser.readUser();
            break;
          case FlagType.ROLE:
            value = parser.readRole();
            break;
          case FlagType.CHANNEL:
            value = parser.readChannel();
            break;
          case FlagType.VOID:
            value = true;
            break;
        }

        if (value === null) {
          context.reply(`:x: Invalid value of \`${flag.name}\``);
          return true;
        }
        args[flag.name] = value;
      }

      const missingFlags = flags
        .filter((flag) => flag.required && args[flag.name] === null)
        .map((flag) => '`' + flag.name + '`')
        .join(', ');
      if (missingFlags.length !== 0) {
        context.reply(`:x: Missing value of ${missingFlags}`);
        return true;
      }
    } else if (body.length !== 0) {
      await context.reply(':x: This command takes no arguments');
      return true;
    }

    await command.execute(context, args);
  } catch (e) {
    context.reply(':boom: Something went wrong');
    console.error(e);
  }

  return true;
}

class Parser {
  private str: string;
  private nextChar: number;
  private context: CommandContext;

  public constructor(str: string, context: CommandContext) {
    this.str = str;
    this.nextChar = 0;
    this.context = context;
  }

  public isEOF() {
    return this.nextChar > this.str.length - 1;
  }

  public readChar(): string {
    return this.str[this.nextChar++];
  }

  public peekChar(): string {
    return this.str[this.nextChar];
  }

  public previousChar(): string {
    return this.str[this.nextChar - 1];
  }

  public cursor(): number {
    return this.nextChar;
  }

  public readWord(): string {
    let result = '';
    while (!(this.isEOF() || this.readChar() == ' '))
      result += this.previousChar();

    return result;
  }

  public readString(): string | null {
    if (
      this.peekChar() === '"' ||
      this.peekChar() === "'" ||
      this.peekChar() === '`'
    ) {
      const delim = this.readChar();

      let result = '';
      while (this.readChar() !== delim) {
        if (this.isEOF()) return null;

        if (this.previousChar() === '\\') result += this.readChar();
        else result += this.previousChar();
      }

      return result;
    }

    return this.readWord();
  }

  public readNumber(): number | null {
    const word = this.readWord();
    console.log(word);
    const result = Number(word);
    if (isNaN(result)) return null;

    return result;
  }

  public readUser(): string | null {
    const arg = this.readString();
    if (arg === null) return null;

    // loose id
    if (SNOWFLAKE.test(arg)) return arg;

    // <@!id>
    if (arg.startsWith('<@') && arg.endsWith('>')) {
      let id = arg.substring(2, arg.length - 1);
      if (id.startsWith('!')) id = id.substring(1);
      if (SNOWFLAKE.test(id)) return id;

      return null;
    }

    return null;
  }

  public readRole(): string | null {
    const arg = this.readString();
    if (arg === null) return null;

    // loose id
    if (SNOWFLAKE.test(arg)) return arg;

    // <@&id>
    if (arg.startsWith('<@&') && arg.endsWith('>')) {
      const id = arg.substring(3, arg.length - 1);
      if (SNOWFLAKE.test(id)) return id;

      return null;
    }

    // role name
    const role = this.context.guild?.roles.cache.find(
      (role) => role.name === arg
    );
    if (role) return role.id;

    return null;
  }

  public readChannel(): string | null {
    const arg = this.readString();
    if (arg === null) return null;

    // loose id
    if (SNOWFLAKE.test(arg)) return arg;

    // <#id>
    if (arg.startsWith('<#') && arg.endsWith('>')) {
      const id = arg.substring(2, arg.length - 1);
      if (SNOWFLAKE.test(id)) return id;

      return null;
    }

    // channel name
    const channel = this.context.guild?.channels.cache.find(
      (channel) => channel.name === arg
    );
    if (channel) return channel.id;

    return null;
  }
}
