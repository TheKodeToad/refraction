import { EmbedBuilder } from 'discord.js';
import { FlagType, defineCommand } from './types';

export default defineCommand({
  name: 'say',
  description: 'Say something through the bot',
  primaryFlag: {
    name: 'content',
    description: 'the content',
    required: true,
    type: FlagType.STRING,
  },
  async execute(context, args) {
    if (!context.member) return;
    if (!context.member.permissions.has("BanMembers")) return;

    if (context.message) context.message.delete();

    const content = args.content;
    const message = await context.channel.send(content);

    if (process.env.SAY_LOGS_CHANNEL) {
      const logsChannel = await context.guild?.channels.fetch(
        process.env.SAY_LOGS_CHANNEL
      );

      if (!logsChannel?.isTextBased()) return;

      await logsChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Say command used')
            .setDescription(content)
            .setAuthor({
              name: context.user.tag ?? '',
              iconURL: context.user.avatarURL() ?? undefined,
            })
            .setURL(message.url),
        ],
        allowedMentions: { parse: ['users'] },
      });
    }
  },
});
