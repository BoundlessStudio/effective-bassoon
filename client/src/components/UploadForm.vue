<template>
  <form class="panel" @submit.prevent="submit">
    <h2>Upload Track</h2>
    <p>Choose a Suno.AI export (mp3/wav) and pick how you want the assistant to help.</p>

    <label class="dropzone" @click="triggerSelect" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <input ref="fileInput" type="file" accept="audio/*" hidden @change="onFileChange" />
      <div v-if="!fileName" class="placeholder">
        <span class="icon">⬆️</span>
        <span>Drag and drop your track or click to browse</span>
      </div>
      <div v-else class="placeholder">
        <span class="icon">🎵</span>
        <span>{{ fileName }}</span>
      </div>
    </label>

    <fieldset>
      <legend>Realtime Mode</legend>
      <label v-for="option in options" :key="option.value" class="option">
        <input type="radio" name="task" :value="option.value" v-model="task" />
        <div>
          <strong>{{ option.label }}</strong>
          <p>{{ option.description }}</p>
        </div>
      </label>
    </fieldset>

    <label class="textarea" v-if="showLyricContext">
      <span>{{ lyricPromptLabel }}</span>
      <textarea v-model="lyricContext" rows="4" placeholder="Share themes, story beats, or existing lyrics to refine"></textarea>
    </label>

    <button type="submit" :disabled="disabled">
      <span v-if="loading">Processing…</span>
      <span v-else>Send to Realtime</span>
    </button>
  </form>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import axios from 'axios';

const emit = defineEmits(['analysis-started', 'analysis-complete']);
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
});

const state = reactive({
  file: null,
});
const fileName = ref('');
const dragging = ref(false);
const task = ref('analysis');
const lyricContext = ref('');
const isSubmitting = ref(false);

const options = [
  {
    value: 'analysis',
    label: 'Music Analysis',
    description: 'Get a breakdown of genre, instrumentation, mix, and standout moments.',
  },
  {
    value: 'general-suggestion',
    label: 'Production Suggestions',
    description: 'Hear ideas for arrangement, mixing, or mastering polish.',
  },
  {
    value: 'lyrics-suggestion',
    label: 'Lyric Brainstorm',
    description: 'Generate original lyrics tailored to your instrumental energy.',
  },
  {
    value: 'lyrics-improvement',
    label: 'Lyric Enhancer',
    description: 'Paste your draft lyrics to get imagery, cadence, and hook upgrades.',
  },
  {
    value: 'sing-demo',
    label: 'AI Sing Demo',
    description: 'Request a short melodic hook sung by the assistant.',
  },
];

const showLyricContext = computed(() => ['lyrics-suggestion', 'lyrics-improvement'].includes(task.value));

const lyricPromptLabel = computed(() =>
  task.value === 'lyrics-improvement' ? 'Paste your current lyrics' : 'Share a theme or story direction'
);

const disabled = computed(() => props.loading || isSubmitting.value || !state.file);

watch(
  () => props.loading,
  (value) => {
    if (!value) {
      isSubmitting.value = false;
    }
  }
);

function triggerSelect() {
  fileInput.value?.click();
}

const fileInput = ref(null);

function onFileChange(event) {
  const [file] = event.target.files ?? [];
  if (!file) return;
  setFile(file);
}

function onDrop(event) {
  dragging.value = false;
  const [file] = event.dataTransfer?.files ?? [];
  if (!file) return;
  setFile(file);
}

function setFile(file) {
  state.file = file;
  fileName.value = file.name;
  dragging.value = false;
}

async function submit() {
  if (!state.file) return;
  isSubmitting.value = true;
  emit('analysis-started');

  try {
    const formData = new FormData();
    formData.append('track', state.file);
    formData.append('task', task.value);
    if (showLyricContext.value) {
      formData.append('lyricContext', lyricContext.value);
    }

    const { data } = await axios.post('/api/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });

    emit('analysis-complete', { task: task.value, result: data });
  } catch (error) {
    console.error('Failed to call realtime backend', error);
    emit('analysis-complete', {
      task: task.value,
      result: {
        error: error?.response?.data?.error ?? error?.message ?? 'Unknown error',
        text: 'The realtime backend call failed. Confirm your API key and server logs.',
      },
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.panel {
  background: rgba(8, 8, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.dropzone {
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  padding: 1.75rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.dropzone.dragging {
  border-color: #6c63ff;
  background: rgba(108, 99, 255, 0.15);
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
}

.placeholder .icon {
  font-size: 1.75rem;
}

fieldset {
  border: none;
  display: grid;
  gap: 0.75rem;
  padding: 0;
}

legend {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.option {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid transparent;
}

.option input[type='radio'] {
  margin-top: 0.2rem;
}

.option strong {
  display: block;
  margin-bottom: 0.25rem;
}

.option p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  opacity: 0.75;
}

.textarea {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.textarea textarea {
  border-radius: 12px;
  border: none;
  padding: 0.75rem;
  font-family: inherit;
  resize: vertical;
}

button {
  padding: 0.9rem 1.2rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(120deg, #6c63ff, #9f7aea);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

button[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

button:not([disabled]):hover {
  transform: translateY(-2px);
}
</style>
