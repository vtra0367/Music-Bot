// src/commands/skip.js
import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skips the current song in the queue.");

export async function execute(interaction) {
    const queueMap = interaction.client.queue;
    const serverQueue = queueMap.get(interaction.guildId);

    if (!serverQueue || serverQueue.songs.length === 0) {
        return interaction.reply({ content: "❌ Hàng đợi trống, không thể bỏ qua.", ephemeral: true });
    }

    if (serverQueue.voiceChannel.id !== interaction.member.voice.channelId) {
        return interaction.reply({ content: "❌ Bạn phải ở cùng kênh thoại với bot.", ephemeral: true });
    }
    
    const skippedTitle = serverQueue.songs[0].title;
    
    // THAY ĐỔI: Dùng giá trị trả về của skip() để xử lý phản hồi
    const skipped = serverQueue.skip(); 

    if (skipped) {
        await interaction.reply(`⏩ Đã bỏ qua: **${skippedTitle}**`);
    } else {
         await interaction.reply({ content: "❌ Không thể bỏ qua. Hàng đợi có thể trống.", ephemeral: true });
    }
}