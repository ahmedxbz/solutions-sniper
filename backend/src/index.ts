import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { YoutubeTranscript } from 'youtube-transcript';
import { downloadAudio } from './services/audio';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import ytSearch from 'yt-search';

const app = new Hono();

app.use('*', cors());

app.get('/', (c) => c.text('Homework Sniper Engine - Autonomous Edition is running!'));

app.post('/api/solve', async (c) => {
  try {
    const body = await c.req.json();
    let { videoUrl, question, grade, subject, page } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: "GEMINI_API_KEY is missing. Get one at aistudio.google.com" }, 500);

    const ytCookie = process.env.YT_COOKIE || "";

    // [DISCOVERY PHASE] If no URL, find one autonomously
    if (!videoUrl) {
      const searchQuery = `شرح ${subject} ${grade} صفحة ${page || ''}`;
      console.log(`[DISCOVERY] Searching YouTube for: ${searchQuery}`);
      
      const r = await ytSearch(searchQuery);
      const topVideo = r.videos.find(v => v.seconds < 1200) || r.videos[0];
      
      if (!topVideo) return c.json({ error: "No relevant instructional video found for this lesson." }, 404);
      
      videoUrl = topVideo.url;
      console.log(`[DISCOVERY] Found Optimized Match (<20m): ${topVideo.title}`);
    }

    let transcriptData = "";
    let audioFilePath = "";
    let methodUsed = "NONE";
    
    // TIER 1: FAST PATH (Transcripts with Cookie Bypass)
    try {
      console.log(`[SNIPER] Checking Transcripts for: ${videoUrl}`);
      // Fallback: If library fails, we have our robust audio sniper next
      const tracks = await YoutubeTranscript.fetchTranscript(videoUrl, { lang: 'ar' });
      transcriptData = tracks.map(t => t.text).join(' ');
      methodUsed = "ARABIC_CC";
    } catch (e) {
      // TIER 2: HEAVY PATH (Gemini Native Audio Sniper)
      console.log(`[SNIPER] Bot detection or No CC. Engaging Gemini Native Audio Sniper...`);
      audioFilePath = await downloadAudio(videoUrl);
    }

    if (!transcriptData && !audioFilePath) {
        return c.json({ error: "Sniper blocked. Please verify your YT_COOKIE in Render." }, 500);
    }

    const target = question ? `the solution for ${question}` : (page ? `the answers for page ${page}` : 'the main exercise solution');
    const context = `Grade: ${grade}. Subject: ${subject}. Iraqi Student Curriculum.`;
    
    let answer = "";

    if (audioFilePath) {
        const { extractAnswerFromAudio } = await import('./services/gemini');
        answer = await extractAnswerFromAudio(apiKey, audioFilePath, 'audio/webm', question, grade, subject);
        methodUsed = "GEMINI_NATIVE_AUDIO";
    } else {
        const { extractAnswer } = await import('./services/gemini');
        // Sending FULL transcript (No windowing!)
        answer = await extractAnswer(apiKey, transcriptData, question, grade, subject);
    }

    if (audioFilePath && fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);

    return c.json({ answer, sourceUrl: videoUrl, method: methodUsed });

  } catch (error: any) {
    console.error(`[FATAL] ${error.message}`);
    return c.json({ error: `Sniper Engine Failure: ${error.message}` }, 500);
  }
});

export default app;
