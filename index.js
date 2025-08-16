import { Client, GatewayIntentBits, PermissionsBitField } from "discord.js";
import cron from "node-cron";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
});

// === CONFIGURATION ===
const GUILD_ID = "YOUR_SERVER_ID";
const CATEGORY_ID = "YOUR_CATEGORY_ID"; // "Post Channels" category
const ROLE_IDS = {
  patreon: "ROLE_ID_PATREON",
  soulFriend: "ROLE_ID_SOULFRIEND",
  diamond: "ROLE_ID_DIAMOND",
  galaxy: "ROLE_ID_GALAXY",
};

// === Helper: format YYYY-MM ===
function getMonthString(date) {
  return date.toISOString().slice(0, 7); // "2025-09"
}

// === Helper: calculate months to keep ===
function getAllowedMonths(monthsBack) {
  const now = new Date();
  let months = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthString(d));
  }
  return months;
}

// === Core: monthly sync ===
async function syncPosts() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const channels = await guild.channels.fetch();

  const now = new Date();
  const currentMonth = getMonthString(now);
  const channelName = `${currentMonth}-posts`;

  // 1. Create channel if not exist
  let postChannel = channels.find(
    (ch) => ch.name === channelName && ch.parentId === CATEGORY_ID
  );
  if (!postChannel) {
    postChannel = await guild.channels.create({
      name: channelName,
      type: 0, // text channel
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: ROLE_IDS.patreon, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: ROLE_IDS.soulFriend, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: ROLE_IDS.diamond, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: ROLE_IDS.galaxy, allow: [PermissionsBitField.Flags.ViewChannel] },
      ],
    });
    console.log(`📌 Created new channel: ${channelName}`);
  }

  // 2. Calculate allowed months
  const diamondAllowed = getAllowedMonths(2); // current + last
  const galaxyAllowed = getAllowedMonths(4);  // current + 3 back

  // 3. Loop through all post channels and set permissions
  for (const [, channel] of channels) {
    if (!channel.parentId || channel.parentId !== CATEGORY_ID) continue;

    const name = channel.name;
    const match = name.match(/^(\d{4}-\d{2})-posts$/);
    if (!match) continue;

    const channelMonth = match[1];

    // Patreon + Soul Friend → always access
    await channel.permissionOverwrites.edit(ROLE_IDS.patreon, {
      ViewChannel: true,
    });
    await channel.permissionOverwrites.edit(ROLE_IDS.soulFriend, {
      ViewChannel: true,
    });

    // Diamond role → only if month is within allowed
    await channel.permissionOverwrites.edit(ROLE_IDS.diamond, {
      ViewChannel: diamondAllowed.includes(channelMonth),
    });

    // Galaxy role → only if month is within allowed
    await channel.permissionOverwrites.edit(ROLE_IDS.galaxy, {
      ViewChannel: galaxyAllowed.includes(channelMonth),
    });
  }

  console.log("✅ Synced post channel permissions");
}

// === Schedule: run every month on 1st at 00:00 ===
cron.schedule("0 0 1 * *", () => {
  syncPosts();
});

// === Manual command (!syncposts) ===
client.on("messageCreate", async (message) => {
  if (message.content === "!syncposts" && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await syncPosts();
    await message.reply("🔄 Synced post permissions!");
  }
});

// === Startup ===
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  syncPosts();
});

client.login(process.env.DISCORD_TOKEN);