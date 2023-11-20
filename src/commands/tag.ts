import { EmbedBuilder } from 'discord.js';
import { getTags } from '../tags';
import { FlagType, defineCommand } from './types';

export default defineCommand({
  name: 'tag',
  aliases: ['faq'],
  description: 'Send a tag',
  primaryFlag: {
    name: 'name',
    description: 'the tag name',
    required: true,
    type: FlagType.STRING,
  },
  flags: [
    {
      name: 'user',
      aliases: ['u'],
      description: 'mention a user',
      type: FlagType.USER,
    },
  ],
  async execute(context, args) {
    const tags = await getTags();
    const { name, user } = args;

    const tag = tags.find(
      (tag) =>
        tag.name.toLowerCase() === name.toLowerCase() ||
        tag.aliases?.includes(name)
    );

    if (!tag) {
      await context.reply(`:x: Tag \`${name}\` does not exist`);
      return;
    }

    const embed = new EmbedBuilder();
    embed.setTitle(tag.title ?? tag.name);
    embed.setDescription(tag.content);
    if (tag.color) embed.setColor(tag.color);
    if (tag.image) embed.setImage(tag.image);
    if (tag.fields) embed.setFields(tag.fields);

    await context.reply({
      content: user ? `<@!${user}> ` : undefined,
      embeds: [embed],
      allowedMentions: { users: user ? [user] : [] },
    });
  },
});
