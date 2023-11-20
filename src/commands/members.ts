import { defineCommand } from './types';
import { COLORS } from '../constants';

export default defineCommand({
  name: 'members',
  description: 'Returns the number of members in the server',
  async execute(context) {
    const memes = await context.guild?.members.fetch().then((r) => r.toJSON());
    if (!memes) {
      await context.reply('Run this command in a server');
      return;
    }

    await context.reply({
      embeds: [
        {
          title: `${memes.length} total members!`,
          description: `${
            memes.filter(
              (m) =>
                m.presence?.status != 'idle' && m.presence?.status != 'offline'
            ).length
          } online members`,
          color: COLORS.blue,
        },
      ],
    });
  },
});
