export type Lane = "kick" | "snare" | "hat" | "chords";
export type SoundKit = "tape" | "chip";
export type FxSettings = Readonly<{ cutoff: number; reverb: number; warble: number; saturation: boolean }>;

export type AudioEngine = {
  context: AudioContext;
  input: BiquadFilterNode;
  meter: AnalyserNode;
  master: GainNode;
  wet: GainNode;
  saturation: WaveShaperNode;
  bedGain: GainNode;
};

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function noiseBuffer(context: BaseAudioContext, seconds: number, brown = false, seed = 317) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0), random = seeded(seed);
  let last = 0;
  for (let index = 0; index < length; index++) {
    const white = random() * 2 - 1;
    if (brown) {
      last = (last + white * 0.025) * 0.997;
      samples[index] = Math.max(-1, Math.min(1, last * 4.5));
    } else samples[index] = white;
  }
  return buffer;
}

function saturationCurve() {
  const curve = new Float32Array(2048);
  for (let index = 0; index < curve.length; index++) {
    const x = (index * 2) / (curve.length - 1) - 1;
    curve[index] = Math.tanh(x * 1.65) / Math.tanh(1.65);
  }
  return curve;
}

function impulse(context: BaseAudioContext) {
  const length = Math.floor(context.sampleRate * 1.35);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  const random = seeded(1085);
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < length; index++) {
      const fade = Math.pow(1 - index / length, 2.5);
      samples[index] = (random() * 2 - 1) * fade * 0.28;
    }
  }
  return buffer;
}

function signalPath(context: BaseAudioContext, settings: FxSettings, output: AudioNode) {
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = settings.cutoff;
  filter.Q.value = 0.72;

  const softener = context.createWaveShaper();
  softener.curve = settings.saturation ? saturationCurve() : null;
  softener.oversample = "2x";
  filter.connect(softener);

  const dry = context.createGain();
  dry.gain.value = settings.saturation ? 0.83 : 1;
  softener.connect(dry).connect(output);

  const room = context.createConvolver();
  room.buffer = impulse(context);
  const wet = context.createGain();
  wet.gain.value = settings.reverb * 0.42;
  softener.connect(room).connect(wet).connect(output);
  return { filter, softener, wet };
}

export function createEngine(): AudioEngine {
  const context = new AudioContext({ latencyHint: "interactive" });
  const meter = context.createAnalyser();
  meter.fftSize = 512;
  meter.smoothingTimeConstant = 0.78;
  const master = context.createGain();
  master.gain.value = 0.84;
  const path = signalPath(context, { cutoff: 15_000, reverb: 0.2, warble: 18, saturation: false }, master);
  master.connect(meter).connect(context.destination);

  const bedFilter = context.createBiquadFilter();
  bedFilter.type = "highpass";
  bedFilter.frequency.value = 480;
  const bedGain = context.createGain();
  bedGain.gain.value = 0;
  const bed = context.createBufferSource();
  bed.buffer = noiseBuffer(context, 2.4, true, 74);
  bed.loop = true;
  bed.connect(bedFilter).connect(bedGain).connect(path.filter);
  bed.start();
  return { context, input: path.filter, meter, master, wet: path.wet, saturation: path.softener, bedGain };
}

export function updateFx(engine: AudioEngine, settings: FxSettings) {
  const now = engine.context.currentTime;
  engine.input.frequency.setTargetAtTime(settings.cutoff, now, 0.025);
  engine.wet.gain.setTargetAtTime(settings.reverb * 0.42, now, 0.035);
  engine.saturation.curve = settings.saturation ? saturationCurve() : null;
}

export function setBedActive(engine: AudioEngine, active: boolean) {
  engine.bedGain.gain.setTargetAtTime(active ? 0.055 : 0, engine.context.currentTime, 0.08);
}

function makeKick(context: BaseAudioContext, time: number, output: AudioNode, kit: SoundKit) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.type = kit === "chip" ? "square" : "sine";
  oscillator.frequency.setValueAtTime(kit === "chip" ? 148 : 120, time);
  oscillator.frequency.exponentialRampToValueAtTime(kit === "chip" ? 38 : 30, time + 0.16);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(kit === "chip" ? 0.62 : 0.82, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
  oscillator.connect(gain).connect(output);
  oscillator.start(time);
  oscillator.stop(time + 0.35);
}

function makeSnare(context: BaseAudioContext, time: number, output: AudioNode, kit: SoundKit, noise: AudioBuffer) {
  const source = context.createBufferSource(), band = context.createBiquadFilter(), hiss = context.createGain();
  source.buffer = noise;
  band.type = "bandpass";
  band.frequency.value = kit === "chip" ? 2_200 : 1_650;
  band.Q.value = 0.72;
  hiss.gain.setValueAtTime(0.0001, time);
  hiss.gain.exponentialRampToValueAtTime(kit === "chip" ? 0.21 : 0.31, time + 0.005);
  hiss.gain.exponentialRampToValueAtTime(0.0001, time + 0.17);
  source.connect(band).connect(hiss).connect(output);
  source.start(time, 0, 0.18);
  source.stop(time + 0.18);

  const body = context.createOscillator(), bodyGain = context.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(190, time);
  body.frequency.exponentialRampToValueAtTime(75, time + 0.075);
  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.exponentialRampToValueAtTime(kit === "chip" ? 0.09 : 0.16, time + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.105);
  body.connect(bodyGain).connect(output);
  body.start(time);
  body.stop(time + 0.11);
}

function makeHat(context: BaseAudioContext, time: number, output: AudioNode, kit: SoundKit, noise: AudioBuffer) {
  const source = context.createBufferSource(), highpass = context.createBiquadFilter(), gain = context.createGain();
  source.buffer = noise;
  highpass.type = "highpass";
  highpass.frequency.value = kit === "chip" ? 6_600 : 7_600;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(kit === "chip" ? 0.085 : 0.12, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
  source.connect(highpass).connect(gain).connect(output);
  source.start(time, 0, 0.045);
  source.stop(time + 0.046);
}

const chords = [
  [130.81, 164.81, 196, 246.94],
  [110, 130.81, 164.81, 196],
  [87.31, 110, 130.81, 164.81],
  [98, 130.81, 146.83, 196],
];

function makeChord(context: BaseAudioContext, time: number, output: AudioNode, kit: SoundKit, warble: number, step: number) {
  const voices = chords[Math.floor(step / 4) % chords.length];
  for (const [index, frequency] of voices.entries()) {
    const oscillator = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
    oscillator.type = kit === "chip" ? "square" : index === 0 ? "triangle" : "sawtooth";
    oscillator.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.value = kit === "chip" ? 2_500 : 3_100;
    filter.Q.value = 1.4;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.055 : 0.032, time + 0.04);
    gain.gain.setValueAtTime(index === 0 ? 0.05 : 0.029, time + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
    oscillator.connect(filter).connect(gain).connect(output);

    const lfo = context.createOscillator(), depth = context.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.23;
    depth.gain.value = warble * 0.11;
    lfo.connect(depth).connect(oscillator.detune);
    oscillator.start(time);
    lfo.start(time);
    oscillator.stop(time + 0.72);
    lfo.stop(time + 0.73);
  }
}

export function playLane(
  context: BaseAudioContext, lane: Lane, time: number, output: AudioNode, kit: SoundKit,
  warble: number, noise = noiseBuffer(context, 0.5, false, 812), step = 0,
) {
  if (lane === "kick") makeKick(context, time, output, kit);
  else if (lane === "snare") makeSnare(context, time, output, kit, noise);
  else if (lane === "hat") makeHat(context, time, output, kit, noise);
  else makeChord(context, time, output, kit, warble, step);
}

export function playCrackle(context: BaseAudioContext, time: number, output: AudioNode, noise: AudioBuffer) {
  const source = context.createBufferSource(), highpass = context.createBiquadFilter(), gain = context.createGain();
  source.buffer = noise;
  highpass.type = "highpass";
  highpass.frequency.value = 1_700;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.055, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.024);
  source.connect(highpass).connect(gain).connect(output);
  source.start(time, 0, 0.03);
  source.stop(time + 0.031);
}

export async function renderStem(
  lane: Lane, pattern: readonly boolean[], settings: FxSettings, kit: SoundKit, bpm: number,
) {
  const bars = 4;
  const stepDuration = 60 / bpm / 4;
  const duration = stepDuration * 16 * bars + 1.8;
  const context = new OfflineAudioContext(2, Math.ceil(duration * 44_100), 44_100);
  const input = signalPath(context, settings, context.destination).filter;
  const noise = noiseBuffer(context, 0.5, false, 812);
  for (let bar = 0; bar < bars; bar++) {
    for (let step = 0; step < 16; step++) {
      if (pattern[step]) playLane(context, lane, (bar * 16 + step) * stepDuration, input, kit, settings.warble, noise, step);
    }
  }
  const buffer = await context.startRendering();
  return encodeFloatWav(buffer);
}

function encodeFloatWav(buffer: AudioBuffer) {
  const channels = Math.min(2, buffer.numberOfChannels), frames = buffer.length;
  const bytesPerSample = 4, dataSize = frames * channels * bytesPerSample;
  const wav = new ArrayBuffer(44 + dataSize), view = new DataView(wav);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 3, true);
  view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 32, true);
  write(36, "data"); view.setUint32(40, dataSize, true);
  const audio = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      view.setFloat32(offset, audio[channel][frame], true);
      offset += bytesPerSample;
    }
  }
  return new Blob([wav], { type: "audio/wav" });
}
