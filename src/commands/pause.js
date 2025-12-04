import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pauses the currently playing music.");

export async function execute(interaction) {
    const queueMap = interaction.client.queue;
    const serverQueue = queueMap.get(interaction.guildId);

    if (!serverQueue) {
        return interaction.reply({ content: "❌ Không có nhạc đang phát.", ephemeral: true });
    }

    if (serverQueue.voiceChannel.id !== interaction.member.voice.channelId) {
        return interaction.reply({ content: "❌ Bạn phải ở cùng kênh thoại với bot.", ephemeral: true });
    }

    if (serverQueue.pause()) {
        await interaction.reply("⏸️ Đã tạm dừng nhạc.");
    } else {
        await interaction.reply({ content: "❌ Nhạc đã dừng hoặc đang tạm dừng.", ephemeral: true });
    }
}