const sounds = {
  pageTurn: { file: "page-turn.wav", volume: 0.22 },
  stamp: { file: "stamp.wav", volume: 0.62 },
};

export function createPassportSounds() {
  if (!window.AudioContext) return null;

  const context = new AudioContext();
  const requests = new AbortController();
  const ready = context.resume().catch(() => {});

  const load = (name: keyof typeof sounds) =>
    fetch(`/sounds/${sounds[name].file}`, { signal: requests.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load passport sound");
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .catch(() => null);
  const buffers = { pageTurn: load("pageTurn"), stamp: load("stamp") };

  return {
    async play(name: keyof typeof sounds) {
      const [buffer] = await Promise.all([buffers[name], ready]);
      if (requests.signal.aborted || context.state !== "running" || !buffer) return;

      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = sounds[name].volume;
      source.connect(gain).connect(context.destination);
      source.onended = () => gain.disconnect();
      source.start();
    },
    dispose() {
      requests.abort();
      void context.close().catch(() => {});
    },
  };
}
