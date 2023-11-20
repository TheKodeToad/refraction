import { COLORS } from '../constants';
import { defineCommand } from './types';

export default defineCommand({
  name: 'stars',
  description: 'Returns GitHub stargazer count',
  deferred: true,
  async execute(context) {
    const count = await fetch(
      'https://api.github.com/repos/PrismLauncher/PrismLauncher'
    )
      .then((r) => r.json() as Promise<{ stargazers_count: number }>)
      .then((j) => j.stargazers_count);

    await context.reply({
      embeds: [
        {
          title: `⭐ ${count} total stars!`,
          color: COLORS.yellow,
        },
      ],
    });
  },
});
