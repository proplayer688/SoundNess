# Friend's Sound Studio: Lo-Fi Beat Lab

A 960 × 640 Rare Friends music studio built for the Rare Friends Vibeathon. The selected Rare Friend's canonical Generations sprite is the studio's beat-reactive producer. Make a loop with four procedural Web Audio instruments, shape it with live effects, and try deterministic, fixed-price upgrade unlocks.

## Run it

From the project root, use Node.js 22 or newer and npm:

```sh
npm ci
npx friendsdk dev ./games/lofi-beat-lab
```

Open the printed local URL. FriendSDK v0.1.2 provides the wallet connection, NFT picker, fresh generation eligibility check, and 960 × 640 sandbox. A playable session needs an injected browser wallet on Robinhood mainnet (chain 4663) that owns a hardwired Rare Friends Generations NFT of generation 1 or higher. This requirement also applies to local previews.

To try it on a phone over the same local network, start the server with:

```sh
npx friendsdk dev ./games/lofi-beat-lab --host 0.0.0.0 --port 4173
```

Open `http://<computer-LAN-IP>:4173` on the phone in a browser with the eligible wallet available. Allow port 4173 through the computer's firewall if needed. Phone wallet support and Robinhood network access depend on the wallet/browser.

On Windows, run FriendSDK commands from WSL2/Ubuntu as described in the [SDK setup guide](https://github.com/spokesz/friendsdk#readme). `npm run typecheck` checks the studio TypeScript sources; run the SDK `check` and browser preview from the supported environment before sharing a playable build.

## Play

- Press **Play** or **Space** to start and pause. Audio starts only after that gesture, as required by browser audio policies.
- Click/tap the 16 pads in the four lanes to write or clear steps. Change tempo from 65 to 95 BPM.
- Click a lane name to solo it. The Friend turns to face that channel and returns to listening when the solo is cleared.
- Drag a knob up or down, or focus it and use the arrow keys. Adjust reverb, low-pass cutoff, and tape warble in real time.
- Use the warm-tape/chiptune switcher, mute button, and system reduced-motion setting as needed.
- Unlock WAV stems to render four bars of your current kick, snare, hat, and chord patterns as 32-bit float WAVs.

## Studio upgrades and economy

The in-studio store has fixed, deterministic preview prices: 50 RF for Analog Tape Saturation & Master Reverb, 100 RF for the 8-Bit Chiptune Sound Bank, 150 RF for the Neo-Tokyo Rainy Night theme, and 200 RF for the WAV/stem renderer. There are no random drops, odds, or prize outcomes. Preview credits are a separate 500 RF playtest balance, clearly labeled as simulated; they do not reflect the SDK wallet balance and do not call `client.buy`, spend/burn RF, or create durable items. Unlocks and remaining preview credits reset when the session reloads or changes Friend.

FriendSDK v0.1.2 supports identity, its fixed chance-game action client, and session-only preview state, but has no general deterministic upgrade-purchase or persistent-save API. The CLI still requires `game.json`; its single, zero-gamble entry is an unused placeholder and is never offered by the game. Converting these prices into permanent on-chain RF burns requires a future supported purchase/action flow and durable item storage. No wallet transactions are sent by this prototype.

The WAV is rendered in the browser. The current CLI child iframe uses `sandbox="allow-scripts"` and does not expose a download-permission option, so browsers may block saving the rendered WAV links. The game keeps the prepared files available in its in-frame export panel and names the host permission needed for downloads; audio is not uploaded.

## Assets and implementation

- Friend identity, selection, ownership verification, and the local preview runtime: FriendSDK v0.1.2.
- Friend portrait: the selected NFT's canonical pixel frames read from the SDK's Generations sprite registry. The sprite shape is drawn directly; no stand-in character or external artwork is used.
- Kick, snare/rim, high-hat/shaker, velvet chords, and vinyl texture: synthesized in code using the browser's native Web Audio API. No external audio files.
- Studio scenery, desk, meters, lighting, and rain: local CSS and canvas drawing; no third-party visual assets.

## SDK definition note

`game.json` contains one deterministic `Unused SDK placeholder` definition because the v0.1.2 CLI still requires a chance-game schema for all games. The component does not display or invoke it. It is not part of the upgrade store or the project's RF terms.
