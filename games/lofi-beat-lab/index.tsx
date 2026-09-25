"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createEngine, noiseBuffer, playCrackle, playLane, renderStem, setBedActive, updateFx, type AudioEngine, type FxSettings, type Lane, type SoundKit } from "./audio";
import "@rarefriends/friendsdk/frame.css";
import "./style.css";

type UpgradeId = "analog" | "chip" | "tokyo" | "exporter";
type KnobProps = { label: string; value: number; min: number; max: number; unit?: string; onChange(value: number): void; format?(value: number): string };
type StepPattern = Record<Lane, boolean[]>;

const LANES: readonly { id: Lane; title: string; short: string; tint: string; face: SpriteFacing }[] = [
  { id: "kick", title: "LO-FI KICK", short: "KICK", tint: "#e8a776", face: "left" },
  { id: "snare", title: "SNARE / RIM", short: "SNARE", tint: "#ed8790", face: "down" },
  { id: "hat", title: "HAT / SHAKER", short: "HAT", tint: "#e4d081", face: "up" },
  { id: "chords", title: "VELVET CHORDS", short: "CHORDS", tint: "#a995ed", face: "right" },
];
const BASE_PATTERN: StepPattern = {
  kick: [true, false, false, false, false, true, false, false, true, false, false, true, false, false, false, false],
  snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  hat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
  chords: [true, false, false, false, false, false, false, true, true, false, false, false, false, false, true, false],
};
const UPGRADES: readonly { id: UpgradeId; name: string; note: string; cost: number; symbol: string }[] = [
  { id: "analog", name: "Analog tape + room", note: "Saturation · master reverb", cost: 50, symbol: "◉" },
  { id: "chip", name: "8-bit chiptune bank", note: "New square-wave voices", cost: 100, symbol: "▦" },
  { id: "tokyo", name: "Neo-Tokyo night", note: "A neon rainy-room theme", cost: 150, symbol: "✳" },
  { id: "exporter", name: "WAV stem exporter", note: "Four custom 32-bit stems", cost: 200, symbol: "↗" },
];
const STARTING_DEMO_BALANCE = 500;
const CREDIT_LABEL = "SIM RF";
const formatTinyRf = (amount: bigint) => `${formatGameAmount(amount, 18)} RF`;

function Rotary({ label, value, min, max, onChange, format = number => `${Math.round(number)}%` }: KnobProps) {
  const drag = useRef({ y: 0, value: 0 });
  const angle = -132 + ((value - min) / (max - min)) * 264;
  const step = Math.max(1, Math.round((max - min) / 100));
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    drag.current = { y: event.clientY, value };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const range = max - min;
    onChange(Math.max(min, Math.min(max, drag.current.value + Math.round((drag.current.y - event.clientY) * range / 120))));
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (["ArrowUp", "ArrowRight", "PageUp"].includes(event.key)) { event.preventDefault(); onChange(Math.min(max, value + step)); }
    if (["ArrowDown", "ArrowLeft", "PageDown"].includes(event.key)) { event.preventDefault(); onChange(Math.max(min, value - step)); }
    if (event.key === "Home") { event.preventDefault(); onChange(min); }
    if (event.key === "End") { event.preventDefault(); onChange(max); }
  };
  return <div className="fx-knob-wrap">
    <div className="fx-knob-label">{label}</div>
    <div className="fx-knob" role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={format(value)} tabIndex={0}
      style={{ "--dial-angle": `${angle}deg` } as CSSProperties} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onKeyDown={onKeyDown}>
      <span className="fx-knob-face"><i /></span>
    </div>
    <span className="fx-knob-value">{format(value)}</span>
  </div>;
}

function friendFacing(solo: Lane | null): SpriteFacing {
  return LANES.find(lane => lane.id === solo)?.face ?? "right";
}

/** Friend identity and wallet selection stay in the trusted FriendSDK host. */
export default function FriendsSoundStudio({ friendId, client, paused }: GameComponentProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [sprites, setSprites] = useState<GenerationSprites | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const [retry, setRetry] = useState(0);
  const [patterns, setPatterns] = useState<StepPattern>(() => structuredClone(BASE_PATTERN));
  const [bpm, setBpm] = useState(82);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [solo, setSolo] = useState<Lane | null>(null);
  const [reverb, setReverb] = useState(22);
  const [cutoff, setCutoff] = useState(13_500);
  const [warble, setWarble] = useState(18);
  const [kit, setKit] = useState<SoundKit>("tape");
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [night, setNight] = useState(false);
  const [unlocked, setUnlocked] = useState<Set<UpgradeId>>(() => new Set());
  const [demoBalance, setDemoBalance] = useState(STARTING_DEMO_BALANCE);
  const [notice, setNotice] = useState("");
  const [busyExport, setBusyExport] = useState(false);
  const [exported, setExported] = useState<{ lane: Lane; title: string; url: string }[]>([]);
  const [exportMenu, setExportMenu] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const friendCanvas = useRef<HTMLCanvasElement>(null);
  const vu = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const toneNoiseRef = useRef<AudioBuffer | null>(null);
  const crackleNoiseRef = useRef<AudioBuffer | null>(null);
  const meterFrame = useRef(0);
  const schedulerTimer = useRef(0);
  const playingRef = useRef(false);
  const nextTime = useRef(0);
  const nextStep = useRef(0);
  const cycle = useRef(0);
  const bpmRef = useRef(bpm);
  const patternRef = useRef(patterns);
  const soloRef = useRef(solo);
  const kitRef = useRef(kit);
  const fxRef = useRef<FxSettings>({ cutoff, reverb, warble, saturation: false });
  const muteRef = useRef(muted);
  const facingRef = useRef<SpriteFacing>("right");
  const reduceRef = useRef(reducedMotion);
  const urlsRef = useRef<string[]>([]);
  const toastTimer = useRef(0);
  bpmRef.current = bpm;
  patternRef.current = patterns;
  soloRef.current = solo;
  kitRef.current = kit;
  reduceRef.current = reducedMotion;
  muteRef.current = muted;
  fxRef.current = { cutoff, reverb, warble, saturation: unlocked.has("analog") };
  facingRef.current = friendFacing(solo);

  useEffect(() => {
    const version = retry;
    let alive = true;
    setLoadingError(""); setSnapshot(null); setSprites(null);
    void Promise.all([createFriendReader().read(friendId), client.read()]).then(([artwork, value]) => {
      if (!alive || version !== retry) return;
      if (value.friendId !== friendId) throw new Error("Studio session does not match the selected Rare Friend.");
      setSprites(artwork); setSnapshot(value);
    }).catch(error => {
      if (!alive) return;
      setLoadingError(error instanceof Error ? error.message : "The studio could not load your Friend.");
    });
    return () => { alive = false; };
  }, [friendId, client, retry]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = friendCanvas.current, context = canvas?.getContext("2d");
    if (!canvas || !context || !sprites) return;
    let frame = 0, lastPaint = 0, facing = friendFacing(solo);
    const draw = (now: number) => {
      if (now - lastPaint > (reduceRef.current ? 1_000 : 175)) {
        lastPaint = now;
        facing = facingRef.current;
        const sprite = spriteFrame(sprites, facing, false, reduceRef.current ? 0 : Math.floor(now / 740) % 8, facing === "left" ? "left" : "right").frame;
        context.clearRect(0, 0, 128, 128);
        context.imageSmoothingEnabled = false;
        context.fillStyle = "#f4ead7";
        sprite.rows.forEach((row, y) => [...row].forEach((pixel, x) => {
          if (pixel === "#") context.fillRect(x * 8 - 8, y * 8 - 8, 24, 24);
        }));
        context.fillStyle = "#16121b";
        sprite.rows.forEach((row, y) => [...row].forEach((pixel, x) => {
          if (pixel === "#") context.fillRect(x * 8, y * 8, 8, 8);
        }));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [sprites]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    updateFx(engine, fxRef.current);
    engine.master.gain.setTargetAtTime(muteRef.current ? 0 : 0.84, engine.context.currentTime, 0.025);
  }, [cutoff, reverb, warble, unlocked, muted]);

  const schedule = () => {
    const engine = engineRef.current;
    if (!playingRef.current || !engine || engine.context.state !== "running") return;
    const context = engine.context;
    const ahead = context.currentTime + 0.13;
    while (nextTime.current < ahead) {
      const step = nextStep.current;
      const settings = fxRef.current;
      const selectedKit = kitRef.current;
      let downbeat = false;
      for (const lane of LANES) {
        if (!patternRef.current[lane.id][step] || (soloRef.current && soloRef.current !== lane.id)) continue;
        playLane(context, lane.id, nextTime.current, engine.input, selectedKit, settings.warble, toneNoiseRef.current!, step);
        if (lane.id === "kick" || lane.id === "snare") downbeat = true;
      }
      if (downbeat) {
        stage.current?.setAttribute("data-hit", String(step));
        const figure = stage.current?.querySelector<HTMLElement>(".producer-figure");
        if (figure) { figure.classList.remove("is-hit"); void figure.offsetWidth; figure.classList.add("is-hit"); }
      }
      if (step === 0 && cycle.current % 2 === 0 && crackleNoiseRef.current) {
        playCrackle(context, nextTime.current + 0.035, engine.input, crackleNoiseRef.current);
      }
      if (step === 15) cycle.current++;
      setPlayhead(step);
      nextStep.current = (step + 1) % 16;
      nextTime.current += 60 / bpmRef.current / 4;
    }
    schedulerTimer.current = window.setTimeout(() => schedule(), 22);
  };

  const stop = () => {
    playingRef.current = false;
    window.clearTimeout(schedulerTimer.current);
    cancelAnimationFrame(meterFrame.current);
    if (engineRef.current) setBedActive(engineRef.current, false);
    setPlaying(false); setPlayhead(-1);
    stage.current?.classList.remove("is-playing");
  };

  const startMeter = (engine: AudioEngine) => {
    cancelAnimationFrame(meterFrame.current);
    const bins = new Uint8Array(engine.meter.frequencyBinCount);
    const tick = () => {
      if (engineRef.current !== engine) return;
      engine.meter.getByteFrequencyData(bins);
      const bass = bins.slice(0, 9).reduce((sum, value) => sum + value, 0) / (9 * 255);
      stage.current?.style.setProperty("--bass", bass.toFixed(3));
      stage.current?.style.setProperty("--aura-scale", String(1 + bass * 0.17));
      stage.current?.style.setProperty("--aura-alpha", String(0.22 + bass * 0.55));
      if (vu.current) {
        vu.current.querySelectorAll<HTMLElement>(".vu-column").forEach((bar, index) => {
          const energy = bins[(index * 4 + 2) % bins.length] / 255;
          bar.style.setProperty("--vu-height", `${Math.max(10, 10 + energy * 90)}%`);
        });
      }
      meterFrame.current = requestAnimationFrame(tick);
    };
    meterFrame.current = requestAnimationFrame(tick);
  };

  const togglePlayback = async () => {
    if (paused || !snapshot || !sprites) return;
    if (playingRef.current) { stop(); return; }
    try {
      let engine = engineRef.current;
      if (!engine) {
        engine = createEngine();
        engineRef.current = engine;
        toneNoiseRef.current = noiseBuffer(engine.context, 0.5, false, 812);
        crackleNoiseRef.current = noiseBuffer(engine.context, 0.04, false, 47);
      }
      await engine.context.resume();
      engine.master.gain.setTargetAtTime(muteRef.current ? 0 : 0.84, engine.context.currentTime, 0.01);
      setBedActive(engine, true);
      playingRef.current = true;
      nextStep.current = 0; cycle.current = 0; nextTime.current = engine.context.currentTime + 0.055;
      setPlaying(true);
      stage.current?.classList.add("is-playing");
      startMeter(engine);
      schedule();
    } catch (error) {
      setNotice(error instanceof Error ? `Audio could not start: ${error.message}` : "Audio could not start in this browser.");
    }
  };

  useEffect(() => {
    if (paused && playingRef.current) stop();
  }, [paused]);

  useEffect(() => () => {
    playingRef.current = false;
    window.clearTimeout(schedulerTimer.current); window.clearTimeout(toastTimer.current);
    cancelAnimationFrame(meterFrame.current);
    engineRef.current?.context.close();
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName))) return;
      event.preventDefault(); void togglePlayback();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  const updatePattern = (lane: Lane, step: number) => {
    setPatterns(current => {
      const next = { ...current, [lane]: [...current[lane]] };
      next[lane][step] = !next[lane][step];
      patternRef.current = next;
      return next;
    });
  };

  const showNotice = (message: string) => {
    setNotice(message); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNotice(""), 3_200);
  };

  const buyUpgrade = (item: typeof UPGRADES[number]) => {
    if (unlocked.has(item.id)) return;
    if (demoBalance < item.cost) { showNotice("Not enough simulated RF. Your credits reset with this session."); return; }
    setDemoBalance(balance => balance - item.cost);
    setUnlocked(current => new Set(current).add(item.id));
    if (item.id === "tokyo") setNight(true);
    showNotice(`${item.name} unlocked · −${item.cost} simulated RF. No wallet transaction was sent.`);
  };

  const toggleSolo = (lane: Lane) => setSolo(current => current === lane ? null : lane);

  const exportStems = async () => {
    if (!unlocked.has("exporter") || busyExport) return;
    setBusyExport(true); setExported([]);
    urlsRef.current.forEach(url => URL.revokeObjectURL(url)); urlsRef.current = [];
    try {
      const files: { lane: Lane; title: string; url: string }[] = [];
      for (const track of LANES) {
        const blob = await renderStem(track.id, patterns[track.id], fxRef.current, kitRef.current, bpmRef.current);
        const url = URL.createObjectURL(blob); urlsRef.current.push(url);
        files.push({ lane: track.id, title: track.title, url });
      }
      setExported(files); setExportMenu(true);
    } catch (error) {
      showNotice(error instanceof Error ? `WAV render failed: ${error.message}` : "The WAV stems could not be rendered.");
    } finally { setBusyExport(false); }
  };

  if (!snapshot || !sprites) return <div className="studio-loading" role={loadingError ? "alert" : "status"}>
    <div className="loading-orb">♫</div><p>{loadingError || "Tuning the room to your Rare Friend…"}</p>
    <span>FriendSDK · generation art · local sound engine</span>
    {loadingError && <button type="button" className="retry-button" onClick={() => setRetry(value => value + 1)}>Try again</button>}
  </div>;

  const offDisabled = paused;
  const demoName = snapshot.mode === "preview" ? "SESSION PREVIEW" : "LOCAL STORE SIM";
  return <main className="studio-shell" data-theme={night ? "tokyo" : "rain"} aria-label="Friend's Sound Studio">
    <div className="studio-grid" aria-busy={busyExport}>
      <section className={`producer-stage ${playing ? "is-playing" : ""}`} ref={stage} aria-label="Producer stage" data-hit="none">
        <header className="stage-header">
          <div className="brand-lockup"><span className="brand-stamp">RF</span><span><b>FRIEND'S</b><strong>SOUND STUDIO</strong></span></div>
          <span className="session-chip"><i /> {playing ? "REC / PLAY" : "IDLE SESSION"}</span>
          <button className="mute-toggle" type="button" aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Mute studio"} onClick={() => {
            const next = !muted; setMuted(next);
            if (engineRef.current) {
              engineRef.current.master.gain.setTargetAtTime(next ? 0 : 0.84, engineRef.current.context.currentTime, 0.02);
              if (!next) void engineRef.current.context.resume();
            }
          }}>{muted ? "♪̸" : "♪"}</button>
        </header>
        <div className="studio-window" aria-hidden="true">
          <div className="window-grid" /><div className="window-moon" /><div className="rain-stream rain-a" /><div className="rain-stream rain-b" /><div className="rain-stream rain-c" />
          <span className="window-reflection" />
        </div>
        <div className="neon-sign" aria-hidden="true"><span>STAY</span><b>IN THE</b><span>GROOVE</span></div>
        <div className="shelf shelf-left" aria-hidden="true"><i /><i /><i /></div>
        <div className="ambient-aura" aria-hidden="true" />
        <div className="friend-label"><span className="tiny-status">●</span> PRODUCER <b>#{friendId.toString()}</b><span className="friend-mood">{solo ? `FACING ${LANES.find(lane => lane.id === solo)?.short}` : playing ? "IN THE POCKET" : "LISTENING"}</span></div>
        <div className="producer-figure" aria-label={`Rare Friend ${friendId.toString()}, animated to the studio beat`}>
          <div className="producer-aura" /><canvas ref={friendCanvas} className="friend-sprite" width={128} height={128} aria-hidden="true" />
          <span className="mix-hand hand-left" /><span className="mix-hand hand-right" />
          <span className="turn-signal" aria-hidden="true">✦</span>
        </div>
        <div className="side-vu" ref={vu} aria-hidden="true">
          <div className="vu-column"><i /></div><div className="vu-column"><i /></div><div className="vu-column"><i /></div><div className="vu-column"><i /></div><div className="vu-column"><i /></div>
          <small>VU</small>
        </div>
        <div className="mixing-desk" aria-hidden="true">
          <div className="desk-top"><span className="desk-tape">SIDE A · RAIN CHECK</span><span className="desk-indicator"><i /> SIGNAL</span></div>
          <div className="desk-controls">
            {[0, 1, 2, 3, 4, 5].map((column, index) => <div className="mini-channel" key={column}>
              <i className="mini-knob" style={{ "--knob-position": `${28 + (index * 11) % 55}%` } as CSSProperties} />
              <i className="mini-fader"><b style={{ "--fader-position": `${68 - (index * 9) % 45}%` } as CSSProperties} /></i>
              <span>{["K", "S", "H", "C", "FX", "OUT"][index]}</span>
            </div>)}
            <div className="record-platter"><i /><b>RF</b></div>
            <div className="tonearm"><i /></div>
          </div>
          <div className="desk-edge"><span>☾ SOFT FOCUS · VOL. 01</span><span>♪  LATE-NIGHT RADIO</span></div>
        </div>
        <div className="stage-footer">
          <span><i className="footer-dot" /> RAINY ROOM · <b>{playing ? "LIVE" : "ARMED"}</b></span>
          <div className="level-meter"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <span className="friend-id-footer">RARE FRIEND #{friendId.toString()}</span>
        </div>
      </section>

      <aside className="fx-store" aria-label="FX rack and simulated studio store">
        <header className="fx-heading"><div><span className="eyebrow">SHAPE YOUR SOUND</span><h2>FX RACK <span>&amp; SHOP</span></h2></div><div className="credit-counter"><strong>{demoBalance}</strong><small>{CREDIT_LABEL}</small></div></header>
        <div className="knob-row">
          <Rotary label="REVERB" value={reverb} min={0} max={100} onChange={setReverb} />
          <Rotary label="LOW-PASS" value={cutoff} min={450} max={16_000} onChange={setCutoff} format={value => value > 999 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : `${value}Hz`} />
          <Rotary label="TAPE WARP" value={warble} min={0} max={100} onChange={setWarble} />
        </div>
        <div className="kit-switcher" aria-label="Sound pack">
          <span className="kit-label">KIT</span>
          <button type="button" className={kit === "tape" ? "active" : ""} aria-pressed={kit === "tape"} disabled={offDisabled} onClick={() => setKit("tape")}>WARM TAPE</button>
          <button type="button" className={kit === "chip" ? "active" : ""} aria-pressed={kit === "chip"} disabled={!unlocked.has("chip") || offDisabled} onClick={() => setKit("chip")}>{unlocked.has("chip") ? "8-BIT" : "🔒 8-BIT"}</button>
          <span className="kit-live">{kit === "chip" ? "SQUARE" : "SOFT"} <i /></span>
        </div>
        <div className="store-title"><span><b>STUDIO UPGRADES</b><small>Deterministic unlocks · no drops</small></span><span className="sim-stamp">{demoName}</span></div>
        <div className="upgrade-list">
          {UPGRADES.map(item => <article className={`upgrade-card ${unlocked.has(item.id) ? "is-owned" : ""}`} key={item.id}>
            <span className="upgrade-symbol" aria-hidden="true">{item.symbol}</span>
            <span className="upgrade-copy"><b>{item.name}</b><small>{item.note}</small></span>
            {item.id === "exporter" && unlocked.has(item.id) ? <button className="upgrade-action export-action" type="button" disabled={busyExport || offDisabled} onClick={() => void exportStems()}>{busyExport ? "RENDER…" : "WAV ↗"}</button> :
              <button className="upgrade-action" type="button" disabled={unlocked.has(item.id) || demoBalance < item.cost || offDisabled} aria-label={unlocked.has(item.id) ? `${item.name} unlocked` : `Unlock ${item.name} for ${item.cost} simulated RF`}
                onClick={() => buyUpgrade(item)}>{unlocked.has(item.id) ? "✓" : `${item.cost} RF`}</button>}
          </article>)}
        </div>
        <div className="store-disclosure"><span>ⓘ</span> <b>SIMULATED</b> RF · preview credits only. No token burns or permanent items yet.</div>
      </aside>

      <section className="sequencer" aria-label="16 step beat sequencer">
        <header className="seq-header">
          <div className="seq-title"><span className="seq-icon">▦</span><span><b>16-STEP MACHINE</b><small>Make a little room for rhythm</small></span></div>
          <div className="seq-transport">
            <button className={`play-button ${playing ? "playing" : ""}`} type="button" aria-label={playing ? "Pause sequencer" : "Play sequencer"} aria-pressed={playing} disabled={offDisabled}
              onClick={() => void togglePlayback()}><span>{playing ? "Ⅱ" : "▶"}</span>{playing ? "PAUSE" : "PLAY"}<kbd>SPACE</kbd></button>
            <div className="tempo-wrap"><span className="tempo-label">TEMPO <b>{bpm}</b><small>BPM</small></span>
              <input aria-label={`Tempo ${bpm} beats per minute`} type="range" min={65} max={95} value={bpm} disabled={offDisabled} style={{ "--tempo-progress": `${((bpm - 65) / 30) * 100}%` } as CSSProperties} onChange={event => setBpm(Number(event.target.value))} />
            </div>
          </div>
          <div className="seq-help"><span>CLICK PADS TO WRITE</span><b>1 — 16</b></div>
        </header>
        <div className="step-numbers" aria-hidden="true"><span className="lane-spacer" />{Array.from({ length: 16 }, (_, index) => <span className={`step-number ${playhead === index ? "current" : ""}`} key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
        <div className="track-list">
          {LANES.map(lane => <div className={`track-row ${solo === lane.id ? "is-solo" : ""}`} key={lane.id} style={{ "--lane-color": lane.tint } as CSSProperties}>
            <button className="lane-select" type="button" disabled={offDisabled} aria-label={solo === lane.id ? `Unsolo ${lane.title}` : `Solo ${lane.title}`} aria-pressed={solo === lane.id} onClick={() => toggleSolo(lane.id)}>
              <span className="lane-led" /><span className="lane-copy"><b>{lane.title}</b><small>{solo === lane.id ? "SOLO · FRIEND IS LISTENING" : lane.id === "chords" ? "SYNTH · FOUR VOICES" : "DRUM MACHINE"}</small></span><span className="solo-tag">{solo === lane.id ? "S" : "·"}</span>
            </button>
            <div className="steps" role="group" aria-label={`${lane.title} 16 step pattern`}>
              {patterns[lane.id].map((active, index) => <button type="button" className={`step-pad ${active ? "active" : ""} ${index === playhead ? "playhead" : ""} ${index % 4 === 0 ? "bar-start" : ""}`} key={index}
                aria-label={`${lane.title}, step ${index + 1}, ${active ? "on" : "off"}`} aria-pressed={active} disabled={offDisabled} onClick={() => updatePattern(lane.id, index)}><span /></button>)}
            </div>
          </div>)}
        </div>
        <footer className="seq-footer"><span><i className="footer-dot" /> {playing ? "CLOCK LOCKED" : "READY WHEN YOU ARE"}</span><span className="seq-footer-tip">SOLO A CHANNEL TO TURN YOUR FRIEND TOWARD IT <span>↗</span></span><span className="loop-count">1 BAR&nbsp; · &nbsp;4/4</span></footer>
      </section>
    </div>
    {notice && <div className="toast-message" role="status">{notice}</div>}
    {exportMenu && <GameMenu title="Your loop · WAV stems" onClose={() => setExportMenu(false)}>
      <p className="export-lede">Four 32-bit float WAV stems, four bars, at {bpm} BPM. Your steps, active kit, filter and room are baked in.</p>
      <div className="stem-list">{exported.map(file => <div className="stem-row" key={file.lane}><span><b>{file.title}</b><small>WAVE · PCM FLOAT · 44.1 kHz</small></span>
        <a href={file.url} download={`friends-studio-${file.lane}-${bpm}bpm.wav`} className="stem-download">SAVE WAV ↓</a></div>)}</div>
      <div className="export-limit"><b>PREVIEW FRAME NOTE</b><br />Your browser may block file saving inside FriendSDK's sandbox. The rendered stems are ready above; the SDK host must allow downloads for Save WAV to work.</div>
      <p className="export-source">This local render does not send your audio or wallet data anywhere.</p>
    </GameMenu>}
  </main>;
}
