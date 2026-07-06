#!/bin/sh
# VULCAN · PART 7 — Kokoro TTS setup (LOCAL neural voice, no cloud).
# Recreates the python3.11 venv and downloads the kokoro-onnx model files. Idempotent.
#
#   sh voice/kokoro/setup.sh
#   # then in .env:  KOKORO_BIN=$(pwd)/voice/kokoro/kokoro-say
#
# Requires python3.11 on PATH. ~350 MB of models are downloaded to ./models
# (gitignored). The venv + models are recreatable, so neither is committed.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

REL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

echo "[kokoro] creating python3.11 venv"
python3.11 -m venv venv
./venv/bin/pip install --upgrade pip -q
echo "[kokoro] installing kokoro-onnx + soundfile"
./venv/bin/pip install -q kokoro-onnx soundfile

mkdir -p models
if [ ! -f models/voices-v1.0.bin ]; then
  echo "[kokoro] downloading voices-v1.0.bin (~28 MB)"
  curl -sL -o models/voices-v1.0.bin "$REL/voices-v1.0.bin"
fi
if [ ! -f models/kokoro-v1.0.onnx ]; then
  echo "[kokoro] downloading kokoro-v1.0.onnx (~310 MB)"
  curl -sL -o models/kokoro-v1.0.onnx "$REL/kokoro-v1.0.onnx"
fi

echo "[kokoro] smoke test"
./kokoro-say "Fire and forge. VULCAN online." -o /tmp/vulcan-kokoro-setup.wav
echo "[kokoro] OK -> /tmp/vulcan-kokoro-setup.wav"
echo "[kokoro] set KOKORO_BIN=$DIR/kokoro-say in .env"
