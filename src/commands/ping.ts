import { defineCommand } from "./types";

export default defineCommand({
  name: 'ping',
  description: 'Replies with pong!',
  execute: async (context) => await context.reply(`Pong! \`${context.client.ws.ping}ms\``),
});