import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

dotenv.config();

const commands = [];
const commandsPath = path.join(process.cwd(), "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const command = await import(fileUrl);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("Started refreshing application (/) commands GLOBALLY.");
        
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID), 
            { body: commands }
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        console.log("LƯU Ý QUAN TRỌNG: Các lệnh toàn cầu có thể mất đến 1 giờ để xuất hiện trên các server.");
    } catch (err) {
        console.error("❌ Lỗi khi đăng ký lệnh toàn cầu:", err);
    }
})();