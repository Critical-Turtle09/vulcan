# VULCAN — Media index

Captured money shots (post-FORGE-amendments). The image/video files live in
`media/` and are **gitignored** (heavy); regenerate any time with **`npm run
media`** (requires the dev server — `npm run dev`) + the ffmpeg step below. This
index is committed as the manifest.

## Stills (`media/*.png`, 1600×1000)

| File | Shot |
|---|---|
| `01-ignition-kindle.png` | Molten sparks kindle over the (sim) desktop — transparency read |
| `02-ignition-strike.png` | The hammer-on-anvil **shockwave ring** thrown from the strike |
| `03-ignition-title.png` | The **"VULCAN" title beat** as sparks cool to bone |
| `04-orb-idle.png` | Orb at idle — near-calm sea + hairline wave-rings |
| `05-orb-speaking-rings.png` | Orb speaking — waves + rings **surge to the audio envelope** |
| `06-taiwan-summon.png` | Taiwan theater — real coastline relief + molten routes |
| `07-wire-ignition.png` | Wire event ignites molten heat + propagates along the network |
| `08-panel-resolve.png` | Tethered blueprint dossier panel resolved |
| `09-schematic-assembled.png` | GPU device schematic condensed from dust |
| `10-schematic-exploded.png` | Schematic **exploded** — die lifts hot, HBM out, VRM forward |
| `11-quench.png` | The **quench** — bank draining to steam-grey over the real screen |

## Motion (`media/`)

| File | Clip |
|---|---|
| `ignition.mp4` | The full ignition ceremony (kindle → strike → title → resolve), h264 |
| `ignition.gif` | Same, as a GIF |
| `seq-ignition/f###.png` | The source PNG sequence (22 frames) |

## Regenerate

```bash
npm run dev            # start the renderer
npm run media          # capture stills + the ignition PNG sequence into media/
# build the clips from the sequence:
cd media
ffmpeg -y -framerate 12 -i seq-ignition/f%03d.png \
  -vf "scale=800:-2:flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -pix_fmt yuv420p ignition.mp4
ffmpeg -y -framerate 12 -i seq-ignition/f%03d.png -vf "scale=640:-1:flags=lanczos,palettegen" /tmp/pal.png
ffmpeg -y -framerate 12 -i seq-ignition/f%03d.png -i /tmp/pal.png \
  -lavfi "scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse" ignition.gif
```
