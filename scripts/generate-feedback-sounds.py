"""Generate original, gentle answer chimes and a silent playback-unlock clip.

Uses only Python's standard library and original synthesized tones.
"""
import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
OUTPUT = ROOT / 'web/audio/effects'
OUTPUT.mkdir(parents=True, exist_ok=True)


def chime(name, notes, duration=0.55):
    samples = []
    for index in range(round(RATE * duration)):
        time = index / RATE
        value = 0.0
        for start, frequency, strength in notes:
            age = time - start
            if age < 0:
                continue
            attack = min(1, age / 0.008)
            release = min(1, (duration - time) / 0.05)
            envelope = attack * release * math.exp(-age * 10)
            # Soft bell harmonics, with a lower-amplitude upper partial.
            value += strength * envelope * (
                math.sin(2 * math.pi * frequency * age)
                + 0.15 * math.sin(2 * math.pi * frequency * 2 * age)
            )
        assert abs(value) <= 1, 'Clipped chime'
        samples.append(round(value * 32767))
    with wave.open(str(OUTPUT / f'{name}.wav'), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(struct.pack(f'<{len(samples)}h', *samples))


chime('correct', [(0, 659.25, 0.24), (0.12, 880, 0.28)])
chime('incorrect', [(0, 440, 0.22), (0.14, 349.23, 0.22)])
# A real user gesture can prepare the same media element before the API answers.
chime('silence', [], duration=0.04)
print('Generated correct.wav, incorrect.wav and silence.wav')
