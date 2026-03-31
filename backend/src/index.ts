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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return c.json({ error: "GROQ_API_KEY is missing" }, 500);

    // [DISCOVERY PHASE] If no URL, find one autonomously
    if (!videoUrl) {
      const searchQuery = `شرح ${subject} ${grade} صفحة ${page || ''}`;
      console.log(`[DISCOVERY] Searching YouTube for: ${searchQuery}`);
      
      const r = await ytSearch(searchQuery);
      // FILTER: Only videos < 20 minutes (1200s) to avoid 429s and keep context tight
      const topVideo = r.videos.find(v => v.seconds < 1200) || r.videos[0];
      
      if (!topVideo) return c.json({ error: "No relevant instructional video found for this lesson." }, 404);
      
      videoUrl = topVideo.url;
      console.log(`[DISCOVERY] Found Optimized Match (<20m): ${topVideo.title}`);
    }

    let transcriptData = "";
    let methodUsed = "NONE";
    
    // TIER 1: FAST PATH (Subtitles / CC)
    try {
      console.log(`[SNIPER] Checking CC for: ${videoUrl}`);
      const tracks = await YoutubeTranscript.fetchTranscript(videoUrl, { lang: 'ar' });
      transcriptData = tracks.map(t => t.text).join(' ');
      methodUsed = "ARABIC_CC";
    } catch (e) {
      try {
        const fallbacks = await YoutubeTranscript.fetchTranscript(videoUrl);
        transcriptData = fallbacks.map(f => f.text).join(' ');
        methodUsed = "FALLBACK_CC";
      } catch (err) {
        // TIER 2: HEAVY PATH (Audio Sniper)
        console.log(`[SNIPER] Engaging Audio Sniper. This might take 30s...`);
        let audioFilePath = await downloadAudio(videoUrl);
        
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(audioFilePath));
            formData.append('model', 'whisper-large-v3');
            formData.append('language', 'ar');
            
            const whisperResponse = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", formData, {
                headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${apiKey}` }
            });
            
            transcriptData = whisperResponse.data.text;
            methodUsed = "GROQ_WHISPER";
        } finally {
            if (audioFilePath && fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
        }
      }
    }

    if (!transcriptData) return c.json({ error: "Could not extract lesson content." }, 500);

    // TIER 3: PRECISION EXTRACTION
    const target = question ? `solve ${question}` : (page ? `solve page ${page}` : 'solve the main exercise');
    const context = `Lesson: ${subject} ${grade}. Context: Iraqi student curriculum.`;

    // High-Efficiency Window (15k chars) to prevent 429s for multiple users
    const transcriptWindow = transcriptData.length > 15000 
        ? transcriptData.substring(transcriptData.length - 15000) 
        : transcriptData;

    const prompt = `You are a precision Iraqi Education Sniper. I need the final answers for ${target}.

Extraction Rules:
1. Output a CLEAN, DISTINCT numbered list.
2. If multiple questions are asked, number them (1, 2, 3...).
3. Extract ONLY the final result of the exercise.
4. NO teaching. NO explanation. NO repetition.
5. If specifically for a Page, filter only for that page's answers.

${context}
Transcript Window (Tail): 
${transcriptWindow}`;

    const groqResponse = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "llama-3.1-8b-instant", 
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1024
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });

    let answer = groqResponse.data.choices[0]?.message?.content?.trim() || "ERROR_NOT_FOUND";
    if (answer.length < 5) answer = "ERROR_NOT_FOUND";

    return c.json({ answer, sourceUrl: videoUrl, method: methodUsed });

  } catch (error: any) {
    console.error(`[FATAL] ${error.message}`);
    return c.json({ error: `Sniper Engine Failure: ${error.message}` }, 500);
  }
});

export default app;

