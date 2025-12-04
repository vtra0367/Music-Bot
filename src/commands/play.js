import { SlashCommandBuilder } from "discord.js";
import ServerQueue from "../utils/queue.js"; 
import { spawn } from "child_process";

export const data = new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a YouTube audio or add it to the queue")
    .addStringOption(option =>
        option.setName("url")
              .setDescription("YouTube URL")
              .setRequired(true)
    );

const ytdlpPath = process.env.YTDLP_PATH || './yt-dlp.exe';

export async function execute(interaction) {
    await interaction.deferReply();
    
    const url = interaction.options.getString("url");
    const channel = interaction.member.voice.channel;
    const guildId = interaction.guildId;
    const queueMap = interaction.client.queue; 

    if (!channel) {
        return interaction.editReply("❌ Bạn cần vào voice channel trước!");
    }

    try {
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return interaction.editReply("❌ Vui lòng dùng link YouTube!");
        }

        // 1. Lấy thông tin video
        await interaction.editReply("⏳ Đang lấy thông tin video...");
        
        const infoProcess = spawn(ytdlpPath, [
            '--get-title',
            '--no-warnings',
            url
        ]);

        let title = url;
        let infoError = null;
        
        infoProcess.stdout.on('data', (data) => {
            title = data.toString().trim();
        });

        infoProcess.on('error', (error) => {
            infoError = error;
        });

        await new Promise((resolve) => {
            infoProcess.on('close', resolve);
            setTimeout(resolve, 5000); 
        });

        if (infoError) {
             return interaction.editReply(`❌ Lỗi khi lấy thông tin video: ${infoError.message}`);
        }
        
        const song = {
            title: title,
            url: url,
            requester: interaction.user.tag,
        };

        // 2. Quản lý hàng đợi
        let serverQueue = queueMap.get(guildId);

        if (!serverQueue) {
            serverQueue = new ServerQueue(guildId, interaction);
            queueMap.set(guildId, serverQueue);
            serverQueue.songs.push(song);
            
            await interaction.editReply(`🎶 Đã thêm **${song.title}** vào hàng đợi. Bắt đầu phát...`);
            serverQueue.playSong(song);

        } else {
            serverQueue.songs.push(song);
            await interaction.editReply(`✅ Đã thêm **${song.title}** vào hàng đợi (Vị trí #${serverQueue.songs.length}).`);
        }
        
    } catch (error) {
        console.error("❌ Lỗi thực thi chung (/play error):", error);
        
        const errorMessage = `❌ Có lỗi xảy ra: ${error.message}`;
        if (interaction.deferred) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
}