# Friend's Sound Studio: Lo-Fi Beat Lab

A 960 × 640 lo-fi studio for the Rare Friends Vibeathon. Your selected Rare Friend takes the producer's seat, reacts to the beat, and keeps the spotlight while you build a loop.

**[▶ Open the live studio](https://proplayer688.github.io/SoundNess/)** · **[Source repository](https://github.com/proplayer688/SoundNess)** · **[Vibeathon submission #71](https://github.com/spokesz/rarefriends-vibeathon/pull/71)**

## The studio

The 16-step deck has four synthesized lanes: lo-fi kick, snare/rimshot, hi-hat/shaker, and polyphonic velvet chords. Set the tempo from 65 to 95 BPM, solo a lane, and shape the playing loop with reverb, a low-pass filter, and tape warble.

The selected Friend's canonical sprite is drawn into the studio scene. It listens while idle, bobs with kick and snare hits, responds to bass energy, and turns toward a soloed lane. Studio lights and meters react to the live audio signal.

## Controls

- Press **Play** or **Space** to start and pause. Browsers start audio after a user gesture.
- Click or tap a step to add or clear a hit.
- Select a lane name to solo it.
- Drag a knob vertically, or focus it and use the arrow keys.
- Tap-friendly controls are provided for touch screens.

## Sound and visuals

Everything is generated in the browser; there are no external audio files.

- **Kick:** sine oscillator with a fast exponential pitch drop.
- **Snare/rimshot:** band-pass filtered noise and a short triangular body.
- **Hi-hat/shaker:** high-pass noise with a tight decay.
- **Velvet chords:** polyphonic synth voices through a resonant low-pass filter with gentle LFO movement.
- **Vinyl texture:** generated noise with subtle crackle impulses.
- **Studio:** locally drawn desk, rain, meters, lighting, and effects.
- **Friend sprite:** read from FriendSDK's canonical Generations sprite registry.

## Store and token transparency

The studio demonstrates fixed preview prices:

| Price | Preview unlock |
| ---: | --- |
| 50 RF | Analog Tape Saturation & Master Reverb |
| 100 RF | 8-Bit Chiptune Sound Bank |
| 150 RF | Neo-Tokyo Rainy Night theme |
| 200 RF | WAV/stem exporter |

A clearly labeled simulated 500 RF session balance is used for preview purchases. The prices are deterministic: no odds, random drops, or gambling. The prototype sends **no token transactions**, burns no real RF, and does not persist unlocks or balances. Changing Friend or reloading starts a fresh preview session.

FriendSDK v0.1.2 does not provide a general deterministic upgrade-purchase or persistent-save API. The SDK also requires a **game.json** schema with a placeholder entry; this studio never displays or invokes that entry.

## Access and compatibility

FriendSDK's public preview requires a connected browser wallet on **Robinhood mainnet (chain 4663)** that owns a Rare Friends Generations NFT at **generation 1 or higher**. This applies before the studio can be played. The public page loads, and the GitHub Actions build and Pages deployment succeeded; the builder did not complete an NFT-gated playthrough.

The game targets FriendSDK's fixed **960 × 640** frame. Grid pads and controls support pointer and touch input, while Space and arrow keys are available on desktop. Mobile wallet support varies by browser and wallet; physical-device testing has not been verified.

## WAV export note

The browser renders four bars of the current kick, snare, hat, and chord patterns as 32-bit float WAV stems. Audio stays in the browser and is not uploaded. The FriendSDK iframe sandbox may block saving the prepared files, depending on browser download permissions.

## Project details

- **Categories:** Character Spotlight (primary), Economy Potential (secondary)
- **Framework:** React + TypeScript
- **Runtime:** FriendSDK v0.1.2
- **Audio:** native Web Audio API
- **Frame:** 960 × 640
- **Deployment:** [GitHub Pages](https://proplayer688.github.io/SoundNess/)
- **Build and deployment status:** [latest verified GitHub Actions run](https://github.com/proplayer688/SoundNess/actions/runs/36143963216)
- **Vibeathon entry:** [pull request #71](https://github.com/spokesz/rarefriends-vibeathon/pull/71)
