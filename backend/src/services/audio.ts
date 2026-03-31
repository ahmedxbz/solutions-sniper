import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';

export async function downloadAudio(videoUrl: string): Promise<string> {
    const videoIdMatch = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : `audio_\${Date.now()}`;
    const filePath = path.join(process.cwd(), `\${videoId}.webm`);
    
    return new Promise((resolve, reject) => {
        console.log(`[AUDIO ENGINE] CC Disabled. Downloading raw stream for: \${videoId}`);
        const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'lowestaudio' });
        const writeStream = fs.createWriteStream(filePath);
        
        stream.pipe(writeStream);
        writeStream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
        writeStream.on('error', reject);
    });
}
