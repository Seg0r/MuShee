# Playback time compression bug (OSMD Cursor–based scheduling)

## IMPORTANT DISCLAIMER

This fix was:

- Developed with AI assistance (ChatGPT 5.2 Max).
- Not verified by any musician nor software developer with deep understanding of library.
- The fix appears to work based on initial observations.

## PR overview

- **Description**:
  - Explain the failure mode of first-empty-tick scheduling
  - Explain the use of OSMD absolute timestamp as the authoritative timeline source
  - Mention fallback behavior for compatibility
- **Code changes**:
  - Extend scheduler API to accept an optional `timeStampRealValue`
  - Pass iterator timestamp from the cursor loop into the scheduler
  - In timestamp mode, compute tick from timestamp; skip creating empty end steps
- **Testing guidance**:
  - Validate on scores containing tuplets / dense subdivisions
  - Confirm that wall-clock duration matches musical duration and does not “speed up forever”

## Bug overview

When building an audio playback timeline from OpenSheetMusicDisplay (OSMD) cursor iterations, it’s possible to unintentionally **compress the musical timeline**, causing playback to run **far faster than intended** (e.g., a multi‑minute piece finishing in a few seconds). This presents as an apparent “tempo increase”, but the root issue is **incorrect event timestamping**, not an actual BPM change.

This document describes the bug pattern and a fix that makes scheduling stable across dense notation (tuplets, very short notes, etc.) by using OSMD’s absolute cursor timestamp.

## Symptoms

- Playback begins at the correct tempo, then after a dense passage (often involving tuplets or rapid subdivisions) playback becomes **permanently too fast** until the end.
- The reported BPM (if logged) may remain constant, yet **musical progress (measures/notes) advances far too quickly** relative to wall-clock time.
- The audio scheduler may appear “healthy” (no obvious catch-up/clamping), because the underlying issue is that future events are placed too early on the internal timeline.

## Root cause

### Problem: “first empty tick” scheduling compresses time

A common approach to building a playback queue from cursor steps is:

1. For each cursor position, add all notes at the current “tick” (start time).
2. Create “end ticks” (tick + note duration) as empty steps.
3. For the next cursor position, choose the next tick as the **first empty tick** in the queue.

This heuristic assumes that:

- “the next musical moment” equals “the earliest note end time we’ve seen so far”

That assumption fails for real-world scores because:

- Cursor steps are **not guaranteed** to align with “earliest note end”.
- Dense rhythmic constructs (e.g., tuplets) can create extremely short note ends, introducing empty ticks very close to the current tick.
- Once an early empty tick exists, subsequent cursor steps can be repeatedly placed at or near these early ticks, **collapsing** the intended spacing between musical events.

The result is an internal timeline where later measures are scheduled much earlier than they should be, producing “minutes in seconds”.

### Key observation

OSMD already exposes an **absolute position timestamp** for the cursor iterator:

- `iterator.currentTimeStamp.realValue` (or variant casing depending on build)

This timestamp is expressed in **whole-note units** (fractional), and it represents the correct global position in the score timeline for the current cursor location.

Ignoring this and relying on “first empty tick” is the core bug.

## Fix

### Use OSMD’s absolute cursor timestamp as the scheduler’s time coordinate

Instead of deriving the next scheduling tick from the queue contents, compute the tick directly:

- `tick = offset + round(iteratorTimeStampRealValue * tickDenominator)`

Where:

- `iteratorTimeStampRealValue` is the cursor iterator’s absolute timestamp in whole-note units
- `tickDenominator` is the scheduler’s ticks-per-whole-note constant (e.g., 1024)
- `offset` is any initial padding/hack (optional) used for better first-note alignment

This makes each cursor step’s start time deterministic and proportional to the true score timeline.

### Avoid generating “empty end steps” when using absolute timestamps

When the scheduler is timestamp-driven:

- You no longer need to create empty “end ticks” for each note purely to locate “the next empty tick”.
- Skipping these empty steps reduces noise in the queue and prevents redundant scheduling callbacks.

### Implementation notes (library-agnostic)

- **Backwards compatibility**: if `currentTimeStamp` is unavailable (or `realValue` cannot be read), fall back to the old heuristic to avoid breaking older OSMD builds.
- **Timestamp access**: OSMD property names can differ between builds (e.g., `CurrentTimeStamp` vs `currentTimeStamp`, `RealValue` vs `realValue`). A robust implementation should try both.

## Why this fixes the “fast forever” symptom

With absolute timestamps:

- Each cursor step is scheduled at its true global position.
- A dense passage can contain very short notes, but it **cannot shift** later steps earlier because later steps have their own fixed timestamps.
- The internal timeline remains stable for the remainder of the piece, eliminating permanent acceleration.
