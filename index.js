import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

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
  const category = guild.channels.cache.get(CATEGORY_ID);
  if (!category) return console.error("Category not found");

  // Create current month channel if missing
  const now = new Date();
  const currentName = getMonthKey(now.getFullYear(), now.getMonth() + 1);
  let currentChannel = category.children.cache.find(ch => ch.name === currentName);
  if (!currentChannel) {
    currentChannel = await guild.channels.create({
      name: currentName,
      type: 0, // GUILD_TEXT
      parent: CATEGORY_ID
    });
  }

  // Iterate over roles and enforce access
  for (const [roleId, monthsBack] of Object.entries(ACCESS_WINDOWS)) {
    const allowed = getCurrentAndPastMonths(monthsBack);

    for (const ch of category.children.cache.values()) {
      if (!ch.isTextBased()) continue;
      if (allowed.includes(ch.name)) {
        await ch.permissionOverwrites.edit(roleId, { ViewChannel: true });
      } else {
        await ch.permissionOverwrites.edit(roleId, { ViewChannel: false });
      }
    }
  }
}

// === BOT EVENTS ===
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Cron job: 1st of each month at 00:00
  cron.schedule("0 0 1 * *", async () => {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    await syncPosts(guild);
    console.log("🔄 Monthly sync complete.");
  });
});

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!syncposts")) return;
  if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await syncPosts(guild);
  msg.reply("✅ Post channels synced!");
});

// === START ===
client.login(process.env.BOT_TOKEN);
