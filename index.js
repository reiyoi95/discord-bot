import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function syncPosts(guild) {
  console.log("🔄 Running syncPosts...");

  try {
    const categoryId = process.env.CATEGORY_ID;
    const starRoleId = process.env.STAR_TIER_ROLE_ID;
    const galaxyRoleId = process.env.GALAXY_TIER_ROLE_ID;

    if (!categoryId || !starRoleId || !galaxyRoleId) {
      console.error("❌ Missing one or more env vars (CATEGORY_ID, STAR_TIER_ROLE_ID, GALAXY_TIER_ROLE_ID)");
      return;
    }

    console.log("✅ Env vars loaded");
    console.log("➡️ CATEGORY_ID:", categoryId);
    console.log("➡️ STAR_TIER_ROLE_ID:", starRoleId);
    console.log("➡️ GALAXY_TIER_ROLE_ID:", galaxyRoleId);

    const category = guild.channels.cache.get(categoryId);
    if (!category) {
      console.error("❌ Category not found in guild:", categoryId);
      return;
    }
    console.log("✅ Found category:", category.name);

    // Generate month channels (current + 2 months ahead)
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const channelName = `${targetDate.getFullYear()}-${String(
        targetDate.getMonth() + 1
      ).padStart(2, "0")}-posts`;

      let channel = category.children.cache.find(
        (ch) => ch.name === channelName
      );
      if (!channel) {
        console.log(`📂 Creating channel: ${channelName}`);
        channel = await guild.channels.create({
          name: channelName,
          type: 0, // text
          parent: category.id,
        });
      } else {
        console.log(`ℹ️ Channel already exists: ${channelName}`);
      }

      // Reset permissions
      console.log(`🔑 Updating permissions for: ${channel.name}`);
      await channel.permissionOverwrites.set([
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: starRoleId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        },
        {
          id: galaxyRoleId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        },
      ]);
    }

    console.log("✅ syncPosts finished!");
  } catch (err) {
    console.error("❌ Error in syncPosts:", err);
  }
}

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log(`💬 Message received: "${message.content}" from ${message.author.tag}`);

  if (message.content === "!syncposts") {
    console.log("📢 !syncposts command detected");
    await syncPosts(message.guild);
    await message.reply("✅ Synced posts! Check logs for details.");
  }
});

client.login(process.env.DISCORD_TOKEN);
