import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stops the music and clears the queue.");

export async function execute(interaction) {
    const queueMap = interaction.client.queue;
    const serverQueue = queueMap.get(interaction.guildId);

    if (!serverQueue) {
        return interaction.reply({ content: "❌ Bot không đang trong voice channel.", ephemeral: true });
    }
    
    if (serverQueue.voiceChannel.id !== interaction.member.voice.channelId) {
        return interaction.reply({ content: "❌ Bạn phải ở cùng kênh thoại với bot.", ephemeral: true });
    }

    serverQueue.stop();
    await interaction.reply("⏹️ Đã dừng và xóa hàng đợi. Bot đã rời kênh voice.");
}