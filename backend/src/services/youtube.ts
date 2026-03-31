import { YoutubeTranscript } from 'youtube-transcript';

export async function getTranscript(videoUrl: string): Promise<string> {
  try {
    // This utilizes a highly robust scanner that finds even hidden auto-generated captions.
    const tracks = await YoutubeTranscript.fetchTranscript(videoUrl, { lang: 'ar' });
    return tracks.map(t => t.text).join(' ');
  } catch (error) {
    try {
      // Fallback if Arabic isn't explicitly tagged
      const tracks = await YoutubeTranscript.fetchTranscript(videoUrl);
      return tracks.map(t => t.text).join(' ');
    } catch (fallbackError) {
       throw new Error("CRITICAL_NO_CC: This specific YouTube video has CC/Transcripts completely forced OFF by the creator. The sniper engine requires at least auto-captions to function.");
    }
  }
}
