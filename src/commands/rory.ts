import { EmbedBuilder } from 'discord.js';
import { FlagType, defineCommand } from './types';

export interface RoryResponse {
  /**
   * The ID of this Rory
   */
  id: number;
  /**
   * The URL to the image of this Rory
   */
  url: string;
  /**
   * When error :(
   */
  error: string | undefined;
}

export default defineCommand({
  name: 'rory',
  description: 'Gets a rory photo!',
  primaryFlag: {
    name: 'id',
    description: 'specify a Rory ID',
    type: FlagType.NUMBER,
  },
  async execute(context, args) {
    const id = args.id ?? "";

    const rory: RoryResponse = await fetch(`https://rory.cat/purr/${id}`, {
      headers: { Accept: 'application/json' },
    }).then((r) => r.json());

    if (rory.error) {
      await context.reply({
        embeds: [
          new EmbedBuilder().setTitle('Error!').setDescription(rory.error),
        ],
      });
      return;
    }

    await context.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Rory :3')
          .setURL(`https://rory.cat/id/${rory.id}`)
          .setImage(rory.url)
          .setFooter({
            text: `ID ${rory.id}`,
          }),
      ],
    });
  },
});
