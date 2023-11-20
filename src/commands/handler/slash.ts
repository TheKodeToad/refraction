import {
  CommandInteraction,
  REST,
  RESTGetAPIOAuth2CurrentApplicationResult,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { COMMANDS } from '..';
import { CommandArgs, CommandContext, FlagType } from '../types';

export async function uploadCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

  const commands = [];

  for (const command of COMMANDS) {
    const slashCommand = new SlashCommandBuilder()
      .setName(command.name)
      .setDescription(command.description);

    const flags = [
      ...(command.primaryFlag ? [command.primaryFlag] : []),
      ...(command.flags ?? []),
    ];
    for (const flag of flags) {
      const option = (option) =>
        option
          .setName(flag.name)
          .setDescription(flag.description)
          .setRequired(flag.required ?? false);
      switch (flag.type) {
        case FlagType.STRING:
          slashCommand.addStringOption(option);
          break;
        case FlagType.NUMBER:
          slashCommand.addNumberOption(option);
          break;
        case FlagType.USER:
          slashCommand.addUserOption(option);
          break;
        case FlagType.ROLE:
          slashCommand.addRoleOption(option);
          break;
        case FlagType.CHANNEL:
          slashCommand.addChannelOption(option);
          break;
        case FlagType.VOID:
          slashCommand.addBooleanOption(option);
          break;
      }
    }
    commands.push(slashCommand.toJSON());
  }

  const { id: appId } = (await rest.get(
    Routes.oauth2CurrentApplication()
  )) as RESTGetAPIOAuth2CurrentApplicationResult;

  await rest.put(Routes.applicationCommands(appId), { body: commands });

  console.log('Successfully registered application commands.');
}

export async function handleInteraction(event: CommandInteraction) {
  if (!event.channel) return;

  const command = COMMANDS.find(
    (command) => command.name === event.commandName
  );
  if (!command) return;

  const flags = [
    ...(command.flags ?? []),
    ...(command.primaryFlag ? [command.primaryFlag] : []),
  ];
  const reply = command.deferred ? await event.deferReply() : null;

  const context: CommandContext = {
    guild: event.guild,
    channel: event.channel,
    user: event.user,
    member: (await event.guild?.members.fetch(event.user)) ?? null,
    client: event.client,
    message: null,
    async reply(message) {
      if (reply) await reply.edit(message);
      else await event.reply(message);
    },
  };
  const args: CommandArgs = {};

  if (flags.length !== 0) {
    for (const option of event.options.data) {
      const flag = flags.find((flag) => flag.name === option.name);
      if (!flag) continue;

      if (flag.type === FlagType.VOID) args[flag.name] = option.value ?? false;
      else args[flag.name] = option.value ?? null;
    }
  }

  await command.execute(context, args);
}
