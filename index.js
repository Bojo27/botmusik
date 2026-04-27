import {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} from "discord.js";

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} from "@discordjs/voice";

import play from "play-dl";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const queue = new Map();

client.once("ready", () => {
  console.log(`🎵 Bot aktif sebagai ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    const query = args.join(" ");
    if (!query) return message.reply("Masukkan judul lagu / link YouTube.");

    const vc = message.member.voice.channel;
    if (!vc) return message.reply("Masuk voice channel dulu.");

    let serverQueue = queue.get(message.guild.id);

    const song = {
      title: query,
      url: query
    };

    if (!serverQueue) {
      const songs = [];
      songs.push(song);

      const connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator
      });

      const player = createAudioPlayer();

      const data = {
        textChannel: message.channel,
        connection,
        player,
        songs
      };

      queue.set(message.guild.id, data);
      playSong(message.guild, songs[0]);

    } else {
      serverQueue.songs.push(song);
      message.reply(`📥 Ditambahkan ke queue: ${query}`);
    }
  }

  if (command === "skip") {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return;
    serverQueue.player.stop();
    message.reply("⏭ Lagu di-skip.");
  }

  if (command === "stop") {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return;

    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);

    message.reply("🛑 Musik dihentikan.");
  }

  if (command === "queue") {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("Queue kosong.");

    const desc = serverQueue.songs.map((s, i) =>
      `${i + 1}. ${s.title}`
    ).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🎶 Daftar Lagu")
      .setDescription(desc);

    message.reply({ embeds: [embed] });
  }
});

async function playSong(guild, song) {
  const serverQueue = queue.get(guild.id);

  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guild.id);
    return;
  }

  const stream = await play.stream(song.url);

  const resource = createAudioResource(stream.stream, {
    inputType: stream.type
  });

  serverQueue.player.play(resource);
  serverQueue.connection.subscribe(serverQueue.player);

  serverQueue.textChannel.send(`🎵 Memutar: ${song.title}`);

  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
    serverQueue.songs.shift();
    playSong(guild, serverQueue.songs[0]);
  });
}

client.login(process.env.TOKEN);
