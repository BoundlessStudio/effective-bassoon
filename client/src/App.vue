<template>
  <main class="app">
    <header>
      <h1>OpenAI Realtime Music Co-Pilot</h1>
      <p>Upload your Suno.AI track to explore realtime analysis, lyric ideas, and even a quick AI sing demo.</p>
    </header>

    <section class="grid">
      <upload-form @analysis-started="onStart" @analysis-complete="onResult" :loading="loading" />

      <article class="results" v-if="result">
        <h2>Realtime Response</h2>
        <div v-if="result.error" class="error" role="alert">
          <strong>Request failed:</strong>
          <span>{{ result.error }}</span>
        </div>
        <p v-if="loading" class="loading">Awaiting realtime response…</p>
        <p class="task">Mode: <strong>{{ taskLabel }}</strong></p>
        <pre class="text" v-if="result.text">{{ result.text }}</pre>

        <section v-if="result.audioBase64" class="audio">
          <h3>AI Vocal Hook</h3>
          <audio controls :src="audioSrc"></audio>
          <p class="hint">Download or share the improvised idea with your collaborators.</p>
        </section>
      </article>

      <article class="results empty" v-else>
        <h2>Realtime Response</h2>
        <p v-if="loading">Awaiting realtime response…</p>
        <p v-else>Run an analysis to see insights, lyric ideas, or listen to a generated hook.</p>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue';
import UploadForm from './components/UploadForm.vue';

const result = ref(null);
const loading = ref(false);
const lastTask = ref('analysis');

function onStart() {
  loading.value = true;
  result.value = null;
}

function onResult(payload) {
  result.value = payload?.result ?? null;
  loading.value = false;
  if (payload?.task) {
    lastTask.value = payload.task;
  }
}

const taskLabel = computed(() => {
  const mapping = {
    analysis: 'Music Analysis',
    'general-suggestion': 'Production Suggestions',
    'lyrics-suggestion': 'Fresh Lyrics',
    'lyrics-improvement': 'Lyric Refinement',
    'sing-demo': 'AI Vocal Hook',
  };
  return mapping[lastTask.value] ?? 'Music Analysis';
});

const audioSrc = computed(() => {
  if (!result.value?.audioBase64) return '';
  return `data:audio/wav;base64,${result.value.audioBase64}`;
});
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: radial-gradient(circle at top, #1f1f46, #0f0f1e 60%);
  color: #f5f6ff;
  padding: 3rem clamp(1rem, 5vw, 4rem);
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

header {
  max-width: 720px;
  margin-bottom: 2.5rem;
}

header h1 {
  font-size: clamp(2.4rem, 4vw, 3.6rem);
  margin-bottom: 0.75rem;
}

header p {
  line-height: 1.6;
  font-size: 1.05rem;
  opacity: 0.85;
}

.grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.results {
  background: rgba(15, 15, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
}

.results h2 {
  margin-bottom: 0.5rem;
}

.results .loading {
  margin-bottom: 0.75rem;
  font-style: italic;
  opacity: 0.7;
}

.results .task {
  margin-bottom: 1rem;
  opacity: 0.75;
}

.results pre {
  white-space: pre-wrap;
  background: rgba(255, 255, 255, 0.05);
  padding: 1rem;
  border-radius: 12px;
  line-height: 1.6;
}

.results.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
}

.audio {
  margin-top: 1.5rem;
}

.audio audio {
  width: 100%;
  margin-bottom: 0.5rem;
}

.audio .hint {
  font-size: 0.85rem;
  opacity: 0.7;
}

.error {
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 107, 107, 0.6);
  background: rgba(255, 107, 107, 0.12);
  color: #ffd7d7;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>
