import { ENV } from "./env";

interface TranscribeOptions {
  audioUrl: string;
  language?: string;
  prompt?: string;
}

interface TranscribeSuccess {
  text: string;
  duration?: number;
  language?: string;
}

interface TranscribeError {
  error: string;
}

type TranscribeResult = TranscribeSuccess | TranscribeError;

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(options: TranscribeOptions): Promise<TranscribeResult> {
  const { audioUrl, language = "ar", prompt } = options;

  const apiKey = ENV.openaiApiKey;
  if (!apiKey) {
    return { error: "OpenAI API key not configured" };
  }

  try {
    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return { error: `Failed to download audio: ${audioResponse.statusText}` };
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

    // Send to OpenAI Whisper API
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    if (language) formData.append("language", language);
    if (prompt) formData.append("prompt", prompt);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Voice] Whisper API error:", errorText);
      return { error: `Whisper API error: ${response.statusText}` };
    }

    const result = await response.json();
    return {
      text: result.text || "",
      language: language,
    };
  } catch (error) {
    console.error("[Voice] Transcription failed:", error);
    return { error: `Transcription failed: ${String(error)}` };
  }
}
