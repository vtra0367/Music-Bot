import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resumes the currently paused music.");

export async function execute(interaction) {
    const queueMap = interaction.client.queue;
    const serverQueue = queueMap.get(interaction.guildId);

    if (!serverQueue) {
        return interaction.reply({ content: "❌ Không có nhạc đang phát.", ephemeral: true });
    }
    
    if (serverQueue.voiceChannel.id !== interaction.member.voice.channelId) {
        return interaction.reply({ content: "❌ Bạn phải ở cùng kênh thoại với bot.", ephemeral: true });
    }

    if (serverQueue.resume()) {
        await interaction.reply("▶️ Đã tiếp tục phát nhạc.");
    } else {
        await interaction.reply({ content: "❌ Nhạc đang phát hoặc không có nhạc nào đang tạm dừng.", ephemeral: true });
    }
}