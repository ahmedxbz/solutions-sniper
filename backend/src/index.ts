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
      const topVideo = r.videos[0];
      
      if (!topVideo) return c.json({ error: "No relevant instructional video found for this lesson." }, 404);
      
      videoUrl = topVideo.url;
      console.log(`[DISCOVERY] Found Best Match: ${topVideo.title}`);
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

    // Safe High-Context Window (30k chars) to prevent 413 Payload Too Large
    const transcriptWindow = transcriptData.length > 30000 
        ? transcriptData.substring(transcriptData.length - 30000) 
        : transcriptData;

    const prompt = `You are a precision Iraqi Education Sniper. I will give you a messy transcript.
Your mission is to output a SINGLE, CONSOLIDATED list of solved exercises.

STRICT CONSTRAINTS:
1. MERGE DUPLICATES: If the teacher explains the same sentence or problem multiple times, you must output it only ONCE.
2. GROUPING: Group all parsing (اعراب) or mathematics related to the same problem number under one heading.
3. IDENTIFY EXERCISES: Look for "التمرين" (Exercise) or sentence numbers to separate tasks.
4. NO REPETITION: Do not summarize the transcript. Sniper-extract the final conclusion for each numbered item.

Format: "X. [Target Problem]: Final Answer"

${context}
Transcript Window: 
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
