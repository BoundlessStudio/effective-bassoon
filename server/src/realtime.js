import WebSocket from 'ws';

const MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';
const API_URL = `wss://api.openai.com/v1/realtime?model=${MODEL}`;

const TASK_PROMPTS = {
  analysis: `You are an experienced music producer. Listen carefully to the uploaded track and provide a concise analysis highlighting genre, mood, instrumentation, mix quality, and any standout moments.`,
  'lyrics-suggestion': `You are a collaborative songwriter. After listening to the instrumental track, propose original lyrics that fit the music's rhythm, mood, and dynamic builds. Provide at least two verses and a chorus.`,
  'lyrics-improvement': `You are an expert lyric editor. Given the listener's context, listen to the track and suggest improvements that enhance imagery, emotional impact, and singability.`,
  'general-suggestion': `You are an AI producer coach. Offer actionable production and arrangement feedback based on what you hear.`,
  'sing-demo': `You are a playful studio vocalist. After listening, improvise a short melodic hook (two bars) using "la" or "do" syllables that matches the instrumental vibe. Return a downloadable audio clip encoded as base64.`,
};

function buildInstruction(task, lyricContext) {
  const basePrompt = TASK_PROMPTS[task] ?? TASK_PROMPTS.analysis;
  if (task === 'lyrics-improvement' && lyricContext) {
    return `${basePrompt}\n\nThe current lyrics are:\n${lyricContext}`;
  }
  if (task === 'lyrics-suggestion' && lyricContext) {
    return `${basePrompt}\n\nKeep in mind the provided theme or story: ${lyricContext}`;
  }
  return basePrompt;
}

export async function analyzeTrack({ task, audioBuffer, lyricContext }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const instruction = buildInstruction(task, lyricContext);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(API_URL, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    let settled = false;

    const closeWithError = (error) => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(error);
      }
    };

    ws.on('open', () => {
      // Append audio buffer in base64 chunks to the realtime session
      const chunkSize = 15_000; // bytes per chunk keeps payloads small
      for (let start = 0; start < audioBuffer.length; start += chunkSize) {
        const chunk = audioBuffer.subarray(start, start + chunkSize);
        const base64Chunk = chunk.toString('base64');
        ws.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Chunk,
          })
        );
      }

      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));

      const response = {
        modalities: task === 'sing-demo' ? ['text', 'audio'] : ['text'],
        instructions: instruction,
        conversation: [],
        audio: task === 'sing-demo' ? { voice: process.env.REALTIME_VOICE || 'alloy' } : undefined,
      };

      ws.send(
        JSON.stringify({
          type: 'response.create',
          response,
        })
      );
    });

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());

        if (event.type === 'error') {
          closeWithError(new Error(event.error?.message || 'Realtime error'));
          return;
        }

        if (event.type === 'response.delta') {
          // We only resolve once we receive the "response.completed" event.
          return;
        }

        if (event.type === 'response.completed') {
          if (settled) return;
          settled = true;

          const { response } = event;
          const textParts = [];
          let audioB64 = null;

          for (const item of response?.output ?? []) {
            for (const content of item?.content ?? []) {
              if (content.type === 'text') {
                textParts.push(content.text ?? '');
              }
              if (content.type === 'audio') {
                audioB64 = content.audio?.data ?? audioB64;
              }
            }
          }

          ws.close();

          resolve({
            task,
            instruction,
            text: textParts.join('\n').trim(),
            audioBase64: audioB64,
          });
        }
      } catch (err) {
        closeWithError(err);
      }
    });

    ws.on('close', () => {
      if (!settled) {
        settled = true;
        reject(new Error('Realtime connection closed unexpectedly.'));
      }
    });

    ws.on('error', (err) => {
      closeWithError(err);
    });
  });
}
