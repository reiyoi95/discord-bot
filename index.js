import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import cron from "node-cron";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;

// === ENV CONFIGURATION ===
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const PATREON_ROLE = process.env.PATREON_ROLE;
const SOUL_ROLE = process.env.SOUL_ROLE;
const DIAMOND_ROLE = process.env.DIAMOND_ROLE;
const GALAXY_ROLE = process.env.GALAXY_ROLE;

// Access windows (months back)
const ACCESS_WINDOWS = {
  [PATREON_ROLE]: 0, // current only
  [SOUL_ROLE]: 1,    // current + 1 back
  [DIAMOND_ROLE]: 2, // current + 2 back
  [GALAXY_ROLE]: 3   // current + 3 back
};

// Log environment check
console.log('🔍 Environment Check:');
console.log(`- PORT: ${port}`);
console.log(`- GUILD_ID: ${GUILD_ID ? '✓' : '✗'}`);
console.log(`- CATEGORY_ID: ${CATEGORY_ID ? '✓' : '✗'}`);
console.log(`- Role IDs configured: ${[PATREON_ROLE, SOUL_ROLE, DIAMOND_ROLE, GALAXY_ROLE].filter(Boolean).length}/4`);

// Health check endpoint with status
app.get('/', (req, res) => {
  const uptime = Math.floor(process.uptime());
  res.json({
    status: 'running',
    uptime: `${uptime}s`,
    bot_status: client.isReady() ? 'connected' : 'connecting'
  });
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent  // Required to read message content
  ]
});

// === HELPERS ===
function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-posts`;
}

function getCurrentAndPastMonths(n) {
  const now = new Date();
  const months = [];

  for (let i = 0; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthKey(d.getFullYear(), d.getMonth() + 1));
  }
  return months;
}

async function syncPosts(guild) {
  console.log('\n🔄 Starting post channel sync...');
  
  const category = guild.channels.cache.get(CATEGORY_ID);
  if (!category) {
    console.error('❌ Category not found! Check CATEGORY_ID in environment variables.');
    return;
  }
  console.log(`📁 Found category: ${category.name}`);

  // Create current month channel if missing
  const now = new Date();
  const currentName = getMonthKey(now.getFullYear(), now.getMonth() + 1);
  console.log(`🔍 Checking for current month channel: ${currentName}`);
  
  let currentChannel = category.children.cache.find(ch => ch.name === currentName);
  if (!currentChannel) {
    console.log('📝 Creating new channel for current month...');
    currentChannel = await guild.channels.create({
      name: currentName,
      type: 0, // GUILD_TEXT
      parent: CATEGORY_ID
    });
    console.log('✅ Created new channel successfully');
  } else {
    console.log('✓ Current month channel already exists');
  }

  // Iterate over roles and enforce access
  console.log('\n📋 Updating channel permissions...');
  for (const [roleId, monthsBack] of Object.entries(ACCESS_WINDOWS)) {
    const allowed = getCurrentAndPastMonths(monthsBack);
    const role = guild.roles.cache.get(roleId);
    console.log(`\n🔑 Processing role: ${role?.name || roleId}`);
    console.log(`   Access window: ${monthsBack} months back`);
    console.log(`   Allowed channels: ${allowed.join(', ')}`);

    let updateCount = 0;
    for (const ch of category.children.cache.values()) {
      if (!ch.isTextBased()) continue;
      const shouldHaveAccess = allowed.includes(ch.name);
      await ch.permissionOverwrites.edit(roleId, { ViewChannel: shouldHaveAccess });
      updateCount++;
    }
    console.log(`   ✓ Updated ${updateCount} channels for this role`);
  }
}

// === ERROR HANDLING ===
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled Promise Rejection:');
  console.error(error);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:');
  console.error(error);
  // Give time for logs to be written before exiting
  setTimeout(() => process.exit(1), 1000);
});

// === BOT EVENTS ===
client.once("ready", () => {
  console.log(`\n✅ Bot is ready!`);
  console.log(`👤 Logged in as: ${client.user.tag}`);
  console.log(`🌐 Connected to ${client.guilds.cache.size} servers`);
  
  // Generate and log invite URL
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=268435456&scope=bot%20applications.commands`;
  console.log(`\n🔗 Invite the bot to your server using this URL:`);
  console.log(inviteUrl);

  // Cron job: 1st of each month at 00:00
  cron.schedule("0 0 1 * *", async () => {
    console.log('\n⏰ Running scheduled monthly sync...');
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      console.log('📥 Fetching guild members...');
      await guild.members.fetch();
      await syncPosts(guild);
      console.log("✨ Monthly sync completed successfully!");
    } catch (error) {
      console.error('❌ Error during monthly sync:');
      console.error(error);
    }
  });
});

client.on("messageCreate", async (msg) => {
  // Debug log for all messages
  console.log(`📨 Message received: "${msg.content}" from ${msg.author.tag}`);
  
  if (!msg.content.startsWith("!syncposts")) {
    console.log('⏭️ Not a syncposts command, ignoring');
    return;
  }
  
  console.log('🎯 Syncposts command detected!');
  
  try {
    if (!msg.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      console.log(`⚠️ Non-admin user ${msg.author.tag} attempted to use !syncposts`);
      return msg.reply("❌ You need administrator permissions to use this command.");
    }

    console.log(`\n🛠️ Manual sync requested by ${msg.author.tag}`);
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log('📥 Fetching guild members...');
    await guild.members.fetch();
    await syncPosts(guild);
    await msg.reply("✅ Post channels synced successfully!");
  } catch (error) {
    console.error('❌ Error during manual sync:');
    console.error(error);
    await msg.reply("❌ An error occurred while syncing channels. Check the logs for details.");
  }
});

// === START ===
// Start the Express server
app.listen(port, () => {
  console.log(`\n🚀 Express server started`);
  console.log(`📡 Listening on port ${port}`);
});

// Start the Discord bot
console.log('\n🤖 Connecting to Discord...');
client.login(process.env.BOT_TOKEN)
  .catch(error => {
    console.error('❌ Failed to connect to Discord:');
    console.error(error);
    process.exit(1);
  });
