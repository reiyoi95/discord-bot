import { Client, GatewayIntentBits } from "discord.js";
import express from "express";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const ROLE_ID = process.env.ROLE_ID;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is not set!");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// --- Discord Bot Login ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.content === "!syncposts") {
    console.log("⚡ !syncposts command received");

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      console.log(`📌 Found guild: ${guild.name}`);

      const category = guild.channels.cache.get(CATEGORY_ID);
      if (!category) {
        console.error("❌ Category not found!");
        return;
      }
      console.log(`📂 Found category: ${category.name}`);

      // Example: create a new channel
      const channelName = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-posts`;
      let channel = guild.channels.cache.find(
        (c) => c.name === channelName && c.parentId === CATEGORY_ID
      );

      if (!channel) {
        channel = await guild.channels.create({
          name: channelName,
          type: 0, // GUILD_TEXT
          parent: CATEGORY_ID,
        });
        console.log(`📌 Created new channel: ${channel.name}`);
      } else {
        console.log(`ℹ️ Channel already exists: ${channel.name}`);
      }

      await message.reply(`✅ Synced posts into #${channel.name}`);
    } catch (err) {
      console.error("❌ Error in !syncposts:", err);
    }
  }
});

client.login(TOKEN);

// --- Express Server for Render ---
const app = express();
app.get("/", (req, res) => {
  res.send("🤖 Discord Bot is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});
