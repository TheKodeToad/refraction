import { defineCommand } from './types';

export default defineCommand({
  name: 'joke',
  description: "It's a joke",
  deferred: true,
  async execute(context) {
    const joke = await fetch('https://icanhazdadjoke.com', {
      headers: { Accept: 'text/plain' },
    }).then((r) => r.text());
    await context.reply(joke);
  },
});
