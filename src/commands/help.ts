import { COMMANDS } from '.';
import { Command, FlagType, defineCommand } from './types';

export function describeShort(command: Command) {
  let result =
    command.name + (command.aliases ? '|' + command.aliases.join('|') : '');

  if (command.primaryFlag) {
    result += ' [' + command.primaryFlag.description + ']';
  }

  if (command.flags) {
    result +=
      ' ' +
      command.flags
        .map((flag) => '-' + flag.name + ' [' + flag.description + ']')
        .join(' ');
  }

  result += ': ' + command.description;

  return result;
}

export default defineCommand({
  name: 'help',
  description: 'Display this message! :O',
  deferred: true,
  primaryFlag: {
    name: 'command',
    description: 'command to describe',
    type: FlagType.STRING,
  },
  async execute(context, args) {
    const commandName = args.command;
    if (commandName) {
      context.reply(`
      ## !${commandName}
      `);
    } else {
      context.reply(`
## Commands
\`\`\`
${COMMANDS.map(describeShort).join('\n\n')}
\`\`\`
      `);
    }
  },
});
