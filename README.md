# 🎛️ Friend's Sound Studio: Lo-Fi Beat Lab

> A rainy-window beat lab where your Rare Friend becomes the producer. Build a loop, shape the sound, and watch the studio move with the rhythm.

**[▶ PLAY THE LIVE STUDIO](https://proplayer688.github.io/SoundNess/)** · **[Vibeathon submission #71](https://github.com/spokesz/rarefriends-vibeathon/pull/71)** · **[Source code](https://github.com/proplayer688/SoundNess)**

---

## Step into the studio

Friend's Sound Studio is a browser-based music toy built for the Rare Friends Vibeathon. A selected Rare Friend takes the spotlight behind the mixing desk while you arrange a beat in a four-lane, 16-step sequencer.

- **Make a loop:** combine lo-fi kick, snare/rimshot, hi-hat/shaker, and velvet chords.
- **Shape the mix:** adjust reverb, low-pass filtering, and tape warble as the loop plays.
- **Play with the character:** the producer reacts to the beat, bass energy, and the lane you solo.
- **Switch the mood:** explore warm tape and chiptune sounds, plus the rainy-night studio theme.
- **Export a loop:** render four bars of your current parts as WAV stems.

## Controls

| Action | How |
| --- | --- |
| Start or pause | Select **Play** or press **Space** |
| Add or remove a hit | Click or tap a step in the grid |
| Change tempo | Use the BPM slider (65–95 BPM) |
| Focus on one part | Select a lane name to solo it |
| Shape the sound | Drag an effect knob; keyboard arrow keys also work |
| Use on a phone | Tap the pads and controls; audio starts after **Play** |

## Studio upgrades

The shop uses set preview prices, so every listed unlock has a known cost:

| Preview price | Upgrade |
| ---: | --- |
| 50 RF | Analog Tape Saturation & Master Reverb |
| 100 RF | 8-Bit Chiptune Sound Bank |
| 150 RF | Neo-Tokyo Rainy Night theme |
| 200 RF | WAV/stem exporter |

### A note about the economy

The shop is a transparent prototype: it starts with a clearly labeled **simulated 500 RF session balance**. Purchases do not spend or burn real $RAREFRIENDS, unlocks do not persist, and there are no random outcomes or gambling. FriendSDK v0.1.2 does not expose a general deterministic upgrade-purchase and save flow yet.

## Before you play

The public demo opens in FriendSDK. Playing requires a connected browser wallet on **Robinhood mainnet (chain 4663)** that owns a Rare Friends Generations NFT at **generation 1 or higher**. FriendSDK applies this requirement in the preview too. The public page and GitHub build are live; the builder could not verify a complete NFT-gated playthrough.

The studio targets FriendSDK's **960 × 640** game frame and includes touch-friendly controls. Mobile wallet availability depends on the browser and wallet; hands-on testing on physical phones has not been verified.

## Sound, made in the browser

All instruments and vinyl texture are synthesized with the native **Web Audio API**. The stage scenery, rain, meters, and lighting are drawn locally. There are no external audio files or third-party visual assets; the Rare Friend sprite comes from FriendSDK's canonical Generations sprite registry.

## Build and platform notes

- **FriendSDK:** v0.1.2
- **App:** React + TypeScript
- **Audio:** native Web Audio API
- **Studio frame:** 960 × 640
- **Deployment:** GitHub Pages; [latest verified build and deployment](https://github.com/proplayer688/SoundNess/actions/runs/36143963216)
- **Submission:** [Rare Friends Vibeathon PR #71](https://github.com/spokesz/rarefriends-vibeathon/pull/71)
- **More detail:** [gameplay, economy, and implementation notes](games/lofi-beat-lab/README.md)

### Export limitation

The four-bar WAV is rendered locally in the browser and is not uploaded. The current FriendSDK iframe may block saving the prepared file, depending on browser sandbox permissions.
