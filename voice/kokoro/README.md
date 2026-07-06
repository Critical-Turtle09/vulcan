# Kokoro TTS — VULCAN's local voice (PART 7)

Local neural text-to-speech for VULCAN, no cloud key required. When
`ELEVENLABS_API_KEY` is absent, the voice organ's provider chain
(`elevenlabs → kokoro → say`) uses this, so VULCAN speaks in a real neural
voice instead of falling all the way through to macOS `say`.

- **Engine:** [`kokoro-onnx`](https://github.com/thewh1teagle/kokoro-onnx)
  (onnxruntime) + `espeakng-loader` (bundled espeak-ng — no system install).
- **Runtime:** a dedicated **python3.11** venv (`./venv`), spawned by the
  Electron main process via `kokoro-say`.
- **Voice:** `bm_george` (British male — the Jarvis-grade forge read) by
  default; override with `KOKORO_VOICE` (e.g. `am_michael`, `af_sarah`).

## Setup

```sh
sh voice/kokoro/setup.sh      # python3.11 venv + ~350 MB model download
# then in .env:
KOKORO_BIN=/absolute/path/to/voice/kokoro/kokoro-say
KOKORO_VOICE=bm_george
```

## Contract

`kokoro-say` matches the `KOKORO_BIN` interface the voice organ expects:

```sh
kokoro-say "<text>" -o <out.wav>     # 24 kHz mono PCM WAV; nonzero exit on failure
```

## Files

- `kokoro-say` — shell entrypoint (`KOKORO_BIN` target); runs `say.py` in the venv.
- `say.py` — the CLI (kokoro-onnx synth → WAV).
- `setup.sh` — recreates venv + downloads models (idempotent).
- `venv/`, `models/` — **gitignored** (heavy, recreatable). ~350 MB of model files
  live in `models/` (`kokoro-v1.0.onnx`, `voices-v1.0.bin`).
