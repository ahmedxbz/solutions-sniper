import { GoogleGenAI } from '@google/genai';

/**
 * Uses Gemini REST API for standard Text Transcripts (Instant).
 */
export async function extractAnswer(apiKey: string, transcript: string, question?: string, grade?: string, subject?: string): Promise<string> {
  if (!apiKey || apiKey === 'test-api-key') {
    throw new Error("Gemini API key is required. Go to local-dev.ts and place your free API Key.");
  }
  
  const target = question ? `the answer to "${question}"` : 'the final answer or main exercise solution';
  const context = `Grade: ${grade || 'Unknown'}, Subject: ${subject || 'Unknown'}`;

  const prompt = `You are a precision extraction algorithm designed to answer educational exercises. 
Your target is to find ${target} in the following lesson transcript. 
${context}

Strict Rules:
1. Extract the literal, verbatim final answer.
2. DO NOT include any conversational filler.
3. NO teaching, NO summaries, NO explanations. Output the exact numbers, text, or equations.
4. If the answer is not explicitly stated in the transcript, output "ERROR_NOT_FOUND".

Transcript:
${transcript.substring(0, 100000)}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    })
  });

  const data = await response.json() as any;
  if (!response.ok) throw new Error(`Gemini API Error: ${data.error?.message || 'Unknown'}`);

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "ERROR_NOT_FOUND";
}

/**
 * Uses the official Google GenAI SDK to natively comprehend Audio files (Slower, heavy fallback).
 */
export async function extractAnswerFromAudio(apiKey: string, audioFilePath: string, mimeType: string, question?: string, grade?: string, subject?: string): Promise<string> {
  if (!apiKey || apiKey === 'test-api-key') {
     throw new Error("The Audio Bypass Engine requires a real Gemini API Key because 10MB+ audio payload must be reliably transferred to Google. Go to local-dev.ts to insert it.");
  }
  
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  console.log(`[GEMINI SDK] Activating File Upload protocol to Google...`);
  const uploadResult = await ai.files.upload({
      file: audioFilePath,
      mimeType: mimeType,
  });
  
  const target = question ? `the answer to "${question}"` : 'the final answer or main exercise solution';
  const context = `Grade: ${grade || 'Unknown'}, Subject: ${subject || 'Unknown'}`;

  const prompt = `You are a precision extraction algorithm designed to answer exercises for Iraqi students. 
Listen to the following lesson audio. Your target is to find ${target}. 
${context}

Strict Rules:
1. Extract the literal, verbatim final answer.
2. DO NOT include conversational filler.
3. NO teaching, NO summaries. Output exact equations/text.
4. If the answer is not in the audio, output "ERROR_NOT_FOUND".`;

  console.log(`[GEMINI SDK] Unleashing Audio generation model over uploaded file...`);
  const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
          { role: 'user', parts: [{ text: prompt }, { fileData: uploadResult }] }
      ],
      config: { temperature: 0.1 }
  });

  return response.text() || "ERROR_NOT_FOUND";
}
