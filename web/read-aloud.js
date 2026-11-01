// Locale keys are stable; saved game text is checked before playing a recording.
export function readingClips(catalogue, quizID, question) {
  const entries = [
    [`quiz.${quizID}.prompt`, question.prompt, null],
    ...question.options.map((option) => [`answer.${quizID}.${option.id}`, option.label, option.id]),
  ];
  if (entries.some(([key, text]) => catalogue.messages[key] !== text || !catalogue.audio[key])) return [];
  return entries.map(([key, , optionID]) => ({ url: catalogue.audio[key], optionID }));
}

export function createReader({ createAudio = () => new Audio(), onHighlight, onPlaying, onError }) {
  let generation = 0;
  let active = null;
  let cancelPending = null;
  let sharedAudio = null;
  function stop() {
    generation += 1;
    cancelPending?.();
    cancelPending = null;
    if (active) {
      active.pause();
      active.removeAttribute('src');
      active.load();
      active = null;
    }
    onHighlight(null);
    onPlaying(false);
  }
  async function play(clips) {
    stop();
    if (!clips.length) return;
    const token = generation;
    onPlaying(true);
    try {
      // Reuse one audio element throughout the user-initiated sequence.
      const audio = sharedAudio ||= createAudio();
      active = audio;
      for (const clip of clips) {
        if (token !== generation) return;
        onHighlight(clip.optionID);
        await new Promise((resolve, reject) => {
          let settled = false;
          const cleanup = () => {
            audio.onended = null;
            audio.onerror = null;
            cancelPending = null;
          };
          const finish = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (error) reject(error); else resolve();
          };
          cancelPending = () => finish();
          audio.onended = () => finish();
          audio.onerror = () => finish(new Error('Audio unavailable'));
          audio.src = clip.url;
          audio.play().catch(finish);
        });
      }
    } catch {
      if (token === generation) onError();
    } finally {
      if (token === generation) stop();
    }
  }
  return { play, stop };
}
