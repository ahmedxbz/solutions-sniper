import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';

export async function downloadAudio(videoUrl: string): Promise<string> {
    const videoIdMatch = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : `audio_\${Date.now()}`;
    const filePath = path.join(process.cwd(), `\${videoId}.webm`);
    
    return new Promise((resolve, reject) => {
        const ytCookie = process.env.YT_COOKIE || "";
        console.log(`[AUDIO ENGINE] CC Disabled. Downloading raw stream (Authenticated) for: ${videoId}`);
        
        const stream = ytdl(videoUrl, { 
            filter: 'audioonly', 
            quality: 'lowestaudio',
            requestOptions: {
                headers: {
                    'Cookie': ytCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        });
        const writeStream = fs.createWriteStream(filePath);
        
        stream.pipe(writeStream);
        writeStream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
        writeStream.on('error', reject);
    });
}
