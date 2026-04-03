// Web Audio API based sound generator - no external files needed

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = "sine", volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Audio not available:", e);
  }
}

export function playEmergencyAlert() {
  // Siren-like sound
  const freqs = [880, 660, 880, 660];
  freqs.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, "sawtooth", 0.15), i * 200);
  });
}

export function playDispatchSound() {
  playTone(440, 0.1, "square", 0.1);
  setTimeout(() => playTone(660, 0.1, "square", 0.1), 120);
  setTimeout(() => playTone(880, 0.15, "square", 0.1), 240);
}

export function playRerouteSound() {
  playTone(523, 0.2, "sine", 0.1);
  setTimeout(() => playTone(440, 0.2, "sine", 0.1), 200);
}

export function playCompleteSound() {
  const freqs = [523, 659, 784, 1047];
  freqs.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, "sine", 0.12), i * 150);
  });
}
