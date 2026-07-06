#!/usr/bin/env python3
# VULCAN · PART 7 — Kokoro TTS CLI (LOCAL neural voice, no cloud).
#
# Matches the KOKORO_BIN contract the voice organ (electron/voice-main.js) expects:
#     kokoro-say "<text>" -o <out.wav>
# so the TTS provider chain (elevenlabs -> kokoro -> say) can spawn it directly and
# play the WAV through the same analyser that drives the orb + rings.
#
# Backend: kokoro-onnx (onnxruntime) + espeakng-loader (bundled espeak-ng, no system
# dep). Model files live in ./models. Nonzero exit + stderr on any failure so the
# organ fails over to macOS `say`.
import sys
import os
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")


def main():
    ap = argparse.ArgumentParser(description="VULCAN Kokoro TTS")
    ap.add_argument("text", help="text to speak")
    ap.add_argument("-o", "--out", required=True, help="output WAV path")
    ap.add_argument("--voice", default=os.environ.get("KOKORO_VOICE", "bm_george"))
    ap.add_argument("--speed", type=float, default=float(os.environ.get("KOKORO_SPEED", "1.0")))
    ap.add_argument("--lang", default=os.environ.get("KOKORO_LANG", "en-us"))
    a = ap.parse_args()

    text = (a.text or "").strip()
    if not text:
        print("kokoro: empty text", file=sys.stderr)
        sys.exit(2)

    onnx = os.path.join(MODELS, "kokoro-v1.0.onnx")
    voices = os.path.join(MODELS, "voices-v1.0.bin")
    for f in (onnx, voices):
        if not os.path.exists(f):
            print(f"kokoro: missing model file {f} (see voice/kokoro/README.md)", file=sys.stderr)
            sys.exit(3)

    # espeak-ng comes from espeakng-loader — point phonemizer-fork at the bundled
    # binary/data so phonemization needs no system install.
    try:
        import espeakng_loader
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        EspeakWrapper.set_library(espeakng_loader.get_library_path())
        EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
    except Exception:
        pass  # phonemizer may still locate a system espeak-ng

    from kokoro_onnx import Kokoro
    import soundfile as sf

    kokoro = Kokoro(onnx, voices)
    samples, sample_rate = kokoro.create(text, voice=a.voice, speed=a.speed, lang=a.lang)
    sf.write(a.out, samples, sample_rate)


if __name__ == "__main__":
    main()
