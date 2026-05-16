/**
 * Lightweight Web Audio “bloops” — no asset files, soft volumes.
 * Call `resumeAudioContext()` after a user gesture so playback works on mobile.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (typeof window === "undefined") throw new Error("no window");
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function resumeAudioContext(): void {
  try {
    const c = getCtx();
    if (c.state === "suspended") void c.resume();
  } catch {
    // ignore
  }
}

function beep(freq: number, durSec: number, gainVal: number) {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = gainVal;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.001, t + durSec);
    o.stop(t + durSec);
  } catch {
    // ignore
  }
}

function beepTriangle(freq: number, durSec: number, gainVal: number) {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.value = gainVal;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.001, t + durSec);
    o.stop(t + durSec);
  } catch {
    // ignore
  }
}

/** Soft tick for countdown (last seconds) */
export function playCountdownTick(secRemaining: number): void {
  const pitch = 520 + (6 - Math.min(5, Math.max(1, secRemaining))) * 35;
  beep(pitch, 0.045, 0.06);
}

/** Your turn started */
export function playTurnCue(): void {
  beep(440, 0.06, 0.055);
  window.setTimeout(() => beep(660, 0.05, 0.045), 70);
}

/** Incoming chat message (other player) */
export function playMessagePop(): void {
  beep(880, 0.035, 0.04);
}

/** Guess flow confirmation */
export function playGuessChime(): void {
  beep(523, 0.05, 0.05);
  window.setTimeout(() => beep(784, 0.055, 0.045), 85);
}

/** UI tap / toggle — short, warm */
export function playUIButton(): void {
  beepTriangle(620, 0.04, 0.055);
}

/** Matchmaking / social “found” */
export function playMatchFound(): void {
  beep(392, 0.07, 0.05);
  window.setTimeout(() => beep(523, 0.08, 0.048), 75);
  window.setTimeout(() => beep(784, 0.1, 0.042), 170);
}

/** Ready toggle */
export function playReadyTap(): void {
  beep(480, 0.05, 0.048);
  window.setTimeout(() => beep(640, 0.055, 0.038), 65);
}

/** Someone joined the room lobby */
export function playRoomJoin(): void {
  beep(330, 0.08, 0.045);
  window.setTimeout(() => beep(440, 0.09, 0.04), 95);
}

/** Correct guess — bright, short */
export function playCorrectGuess(): void {
  beep(523, 0.06, 0.052);
  window.setTimeout(() => beep(659, 0.06, 0.048), 70);
  window.setTimeout(() => beep(784, 0.1, 0.045), 145);
}

/** Wrong guess — soft dip, not punishing */
export function playWrongGuess(): void {
  beep(300, 0.09, 0.042);
  window.setTimeout(() => beep(240, 0.11, 0.035), 100);
}

/** Tiny victory sparkle (legacy hook) */
export function playWinSparkle(): void {
  playVictoryFanfare();
}

/** Full victory sting — mobile-game lift */
export function playVictoryFanfare(): void {
  beep(523, 0.08, 0.05);
  window.setTimeout(() => beep(659, 0.08, 0.048), 85);
  window.setTimeout(() => beep(784, 0.09, 0.046), 170);
  window.setTimeout(() => beep(988, 0.12, 0.04), 265);
}

/** Soft defeat (legacy name) */
export function playDefeatTone(): void {
  playDefeatSoft();
}

/** Softer, playful loss */
export function playDefeatSoft(): void {
  beepTriangle(247, 0.14, 0.048);
  window.setTimeout(() => beepTriangle(196, 0.16, 0.036), 120);
  window.setTimeout(() => beepTriangle(175, 0.18, 0.028), 260);
}

/** Local player sent a chat line */
export function playMessageSend(): void {
  beep(698, 0.032, 0.04);
  window.setTimeout(() => beep(932, 0.028, 0.032), 45);
}

/** Everyone ready — lobby can start */
export function playRoomReady(): void {
  beep(415, 0.07, 0.046);
  window.setTimeout(() => beep(523, 0.08, 0.042), 80);
  window.setTimeout(() => beep(659, 0.1, 0.036), 165);
}
