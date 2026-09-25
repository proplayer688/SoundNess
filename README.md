# Friend's Sound Studio: Lo-Fi Beat Lab

A playable Rare Friends Vibeathon studio built with FriendSDK v0.1.2. Create a 16-step lo-fi loop around your selected Rare Friend, tweak synthesized instruments with live audio effects, and explore a transparent preview of a deterministic $RAREFRIENDS upgrade sink.

## Start a local preview

Requires Node.js 22+ and npm. Install dependencies, then start the official game runner:

```sh
npm ci
npx friendsdk dev ./games/lofi-beat-lab
```

Then open the URL printed by the SDK runner. Playing, including in local preview, requires a connected browser wallet on Robinhood mainnet (chain 4663) holding a hardwired Generations NFT at generation 1 or higher. The official FriendSDK runtime handles wallet connection, Friend selection, eligibility checks, and the sandbox.

For another device on your LAN:

```sh
npx friendsdk dev ./games/lofi-beat-lab --host 0.0.0.0 --port 4173
```

Open `http://<computer-LAN-IP>:4173` on the other device in a browser with an eligible wallet. See the [game README](games/lofi-beat-lab/README.md) for controls, prices, simulation boundaries, and the known WAV download constraint.

On Windows, FriendSDK documents WSL2 as its supported CLI environment. Install dependencies and run the commands from Ubuntu/WSL2. This desktop session is in native PowerShell, WSL2 is not installed, and the SDK build attempt here failed while resolving the Windows workspace path. The app's TypeScript check passes; the SDK browser build and wallet playthrough still need an Ubuntu/WSL2 run.

## Publish a public preview on GitHub Pages

The included [Pages workflow](.github/workflows/pages.yml) builds this game on GitHub's Ubuntu runner and publishes the FriendSDK runtime whenever `main` is updated. To use it, push this project to a GitHub repository, then select **Settings → Pages → GitHub Actions** if Pages asks for a source. The first successful run publishes the site at `https://<owner>.github.io/<repository>/`; future pushes to `main` redeploy it. You can also run it manually from the repository's **Actions** tab. GitHub Pages makes this preview publicly accessible.

## Rare Friends alignment

- **Character Spotlight:** the selected NFT's original sprite is the animated producer, reacting to kick/snare hits, bass amplitude, and soloed lanes.
- **Economy Potential:** fixed prices of 50 / 100 / 150 / 200 RF unlock deterministic studio upgrades. The prototype shows a 500 RF session preview ledger and sends no token transactions. The current SDK has no general upgrade-purchase or persistent-save API; see the game README for details.

No external audio or visual assets are used. All instruments and vinyl texture are synthesized; the stage art is CSS and canvas. Friend artwork is retrieved through the SDK's canonical sprite reader.
