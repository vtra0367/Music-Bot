import { 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    entersState,
    StreamType
} from "@discordjs/voice";
import { spawn } from "child_process";

const ytdlpPath = process.env.YTDLP_PATH || './yt-dlp.exe';
const ffmpegPath = process.env.FFMPEG_PATH || './ffmpeg.exe';

global.queueMap = global.queueMap || new Map(); 

class ServerQueue {
    constructor(guildId, interaction) {
        this.guildId = guildId;
        this.voiceChannel = interaction.member.voice.channel;
        this.textChannel = interaction.channel;
        this.connection = null;
        this.player = createAudioPlayer();
        this.songs = [];
        this.playing = false;
        this.loop = false;
        
        this.currentYtDlp = null;
        this.currentFFmpeg = null;
        
        // Listener cho Player
        this.player.on(AudioPlayerStatus.Idle, () => {
            console.log(`[${this.guildId}] Player Status: Idle. Trying next song.`);
            
            this.songs.shift(); // Xóa bài hát vừa kết thúc
            this.cleanupProcesses(); 
            
            if (this.loop && this.songs.length > 0) {
                this.songs.push(this.songs[0]); 
            }
            
            if (this.songs.length > 0) {
                setImmediate(() => this.playSong(this.songs[0]));
            } else {
                this.playing = false;
                // Bắt đầu đếm ngược 10 giây để ngắt kết nối
                setTimeout(() => {
                    // PHÒNG VỆ: Kiểm tra kết nối trước khi destroy
                    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed && this.songs.length === 0) {
                        this.textChannel.send('🎶 Hàng đợi trống. Đã rời kênh voice.');
                        global.queueMap.delete(this.guildId);
                        this.connection.destroy();
                        this.connection = null; // Rất quan trọng: Thiết lập null sau khi destroy thành công
                    }
                }, 10000); 
            }
        });
        
        this.player.on('error', error => {
            console.error(`[${this.guildId}] Player Error:`, error);
            this.textChannel.send(`❌ Có lỗi khi phát nhạc: \`${error.message}\`. Bỏ qua bài hát.`);
            if (this.player.state.status !== AudioPlayerStatus.Idle) {
                 setImmediate(() => this.skip());
            }
        });

        this.connection?.on(VoiceConnectionStatus.Disconnected, () => {
             // PHÒNG VỆ: Chỉ destroy nếu nó chưa bị phá hủy
             if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
                this.connection.destroy();
             }
             this.connection = null;
             global.queueMap.delete(this.guildId);
             this.textChannel.send('❌ Đã mất kết nối Voice Channel.');
        });
    }

    /**
     * @returns {void} Dọn dẹp và giết các tiến trình con.
     */
    cleanupProcesses() {
        if (this.currentFFmpeg) {
            console.log(`[${this.guildId}] Killing ffmpeg process...`);
            this.currentFFmpeg.kill('SIGKILL'); 
            this.currentFFmpeg = null;
        }
        if (this.currentYtDlp) {
            console.log(`[${this.guildId}] Killing yt-dlp process...`);
            this.currentYtDlp.kill('SIGKILL'); 
            this.currentYtDlp = null;
        }
    }

    async joinChannel() {
        if (this.connection) return this.connection;
        
        console.log(`[${this.guildId}] Đang cố gắng kết nối tới voice channel: ${this.voiceChannel.name}`);
        this.connection = joinVoiceChannel({
            channelId: this.voiceChannel.id,
            guildId: this.voiceChannel.guild.id,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator
        });

        this.connection.subscribe(this.player);

        try {
            await entersState(this.connection, VoiceConnectionStatus.Ready, 30000); 
            return this.connection;
        } catch (err) {
            console.error(`[${this.guildId}] Lỗi Timeout khi kết nối:`, err);
            this.connection.destroy();
            this.connection = null; // Thiết lập null nếu destroy do lỗi
            global.queueMap.delete(this.guildId);
            throw new Error("Không thể kết nối voice channel.");
        }
    }

    async playSong(song) {
        try {
            await this.joinChannel();
        } catch (error) {
            this.textChannel.send(`❌ Lỗi kết nối: ${error.message}`);
            return;
        }

        this.playing = true;
        
        console.log(`[${this.guildId}] Bắt đầu phát: ${song.title} (${song.url})`);
        
        const ytdlpArgs = [
            '-f', 'bestaudio[ext=opus]/bestaudio[ext=m4a]/bestaudio', 
            '-o', '-',
            '--no-warnings',
            song.url
        ];
        const ytdlpProcess = spawn(ytdlpPath, ytdlpArgs);

        const ffmpegArgs = [
            '-i', 'pipe:0',
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-b:a', '256k', 
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ];
        // Dòng log bạn đã yêu cầu để kiểm tra bitrate
        console.log(`[${this.guildId}] FFmpeg Args: ${ffmpegArgs.join(' ')}`);
        
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
        
        this.currentYtDlp = ytdlpProcess;
        this.currentFFmpeg = ffmpegProcess;
        
        ytdlpProcess.once('spawn', () => {
             console.log(`[${this.guildId}] yt-dlp spawned. Piping to FFmpeg.`);
             ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);
        });

        const resource = createAudioResource(ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
        });
        
        this.player.play(resource);
        this.textChannel.send(`🎵 Đang phát: **${song.title}** (Yêu cầu bởi ${song.requester})`);

        // Xử lý lỗi tiến trình
        ytdlpProcess.on('error', (error) => {
            console.error('❌ yt-dlp process error:', error);
            this.textChannel.send('❌ Lỗi yt-dlp khi khởi động. Bỏ qua bài hát.');
            this.skip();
        });
        ffmpegProcess.on('error', (error) => {
            console.error('❌ ffmpeg process error:', error);
            this.textChannel.send('❌ Lỗi ffmpeg khi khởi động. Bỏ qua bài hát.');
            this.skip();
        });
        
        ytdlpProcess.on('close', (code) => {
            if (code !== 0 && code !== null) { 
                console.error(`❌ yt-dlp process exited with code ${code}. Download stream failed.`);
                this.textChannel.send(`❌ Lỗi tải stream (${code}). Bỏ qua bài hát.`);
                this.skip();
            }
            this.currentYtDlp = null; 
        });

        ffmpegProcess.on('close', (code) => {
             if (code !== 0 && code !== null) { 
                console.error(`❌ ffmpeg process exited with code ${code}. Piping failed.`);
             }
             this.currentFFmpeg = null;
        });
    }

    /**
     * Dừng AudioPlayer và kích hoạt Idle event để chuyển bài tiếp theo.
     * @returns {boolean} True nếu skip thành công, ngược lại False.
     */
    skip() {
        if (this.songs.length > 0) {
            this.player.stop(); 
            
            setImmediate(() => {
                this.cleanupProcesses();
            });
            
            return true;
        } 
        return false;
    }

    stop() {
        this.songs = [];
        this.player.stop();
        
        setImmediate(() => {
            this.cleanupProcesses();
        });
        
        // SỬA LỖI: Kiểm tra trạng thái và thiết lập null để ngăn chặn double-destroy
        if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            this.connection.destroy();
            this.connection = null; 
        }
        
        global.queueMap.delete(this.guildId);
        this.textChannel.send('⏹️ Đã dừng và xóa hàng đợi.');
    }

    // ... (pause() và resume() giữ nguyên)
}

export default ServerQueue;