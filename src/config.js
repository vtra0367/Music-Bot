import { platform } from 'os';

const isWindows = platform() === 'win32';

export const config = {
    ytdlpPath: process.env.YTDLP_PATH || (isWindows ? './yt-dlp.exe' : 'yt-dlp'),
    ffmpegPath: process.env.FFMPEG_PATH || (isWindows ? './ffmpeg.exe' : 'ffmpeg')
};