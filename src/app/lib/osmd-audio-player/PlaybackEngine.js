var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
import PlaybackScheduler from './PlaybackScheduler';
import { SoundfontPlayer } from './players/SoundfontPlayer';
import { getNoteDuration, getNoteVolume, getNoteArticulationStyle } from './internals/noteHelpers';
import { EventEmitter } from './internals/EventEmitter';
import { AudioContext } from 'standardized-audio-context';
export var PlaybackState;
(function (PlaybackState) {
  PlaybackState['INIT'] = 'INIT';
  PlaybackState['PLAYING'] = 'PLAYING';
  PlaybackState['STOPPED'] = 'STOPPED';
  PlaybackState['PAUSED'] = 'PAUSED';
})(PlaybackState || (PlaybackState = {}));
export var PlaybackEvent;
(function (PlaybackEvent) {
  PlaybackEvent['STATE_CHANGE'] = 'state-change';
  PlaybackEvent['ITERATION'] = 'iteration';
})(PlaybackEvent || (PlaybackEvent = {}));
export default class PlaybackEngine {
  constructor(context = new AudioContext(), instrumentPlayer = new SoundfontPlayer()) {
    this.defaultBpm = 100;
    this.scoreInstruments = [];
    this.ready = false;
    this.ac = context;
    this.ac.suspend();
    this.instrumentPlayer = instrumentPlayer;
    this.instrumentPlayer.init(this.ac);
    this.availableInstruments = this.instrumentPlayer.instruments;
    this.events = new EventEmitter();
    this.cursor = null;
    this.sheet = null;
    this.scheduler = null;
    this.iterationSteps = 0;
    this.currentIterationStep = 0;
    this.timeoutHandles = [];
    this.playbackSettings = {
      bpm: this.defaultBpm,
      masterVolume: 1,
    };
    // Debug timing: detect bursts of 0-delay scheduling which can sound like tempo "ramping".
    this._debugLastNoteCallbackAtMs = null;
    this._debugZeroDelayBursts = 0;
    this.setState(PlaybackState.INIT);
  }
  get wholeNoteLength() {
    return Math.round((60 / this.playbackSettings.bpm) * 4000);
  }
  getPlaybackInstrument(voiceId) {
    if (!this.sheet) return null;
    const voice = this.sheet.Instruments.flatMap(i => i.Voices).find(v => v.VoiceId === voiceId);
    return this.availableInstruments.find(i => i.midiId === voice.midiInstrumentId);
  }
  setInstrument(voice, midiInstrumentId) {
    return __awaiter(this, void 0, void 0, function* () {
      yield this.instrumentPlayer.load(midiInstrumentId);
      voice.midiInstrumentId = midiInstrumentId;
    });
  }
  loadScore(osmd) {
    return __awaiter(this, void 0, void 0, function* () {
      this.ready = false;
      this.sheet = osmd.Sheet;
      this.scoreInstruments = this.sheet.Instruments;
      this.cursor = osmd.cursor;
      if (this.sheet.HasBPMInfo) {
        this.setBpm(this.sheet.DefaultStartTempoInBpm);
      }
      yield this.loadInstruments();
      this.initInstruments();
      this.scheduler = new PlaybackScheduler(this.wholeNoteLength, this.ac, (delay, notes, meta) =>
        this.notePlaybackCallback(delay, notes, meta)
      );
      this.countAndSetIterationSteps();
      this.ready = true;
      this.setState(PlaybackState.STOPPED);
    });
  }
  initInstruments() {
    for (const i of this.sheet.Instruments) {
      for (const v of i.Voices) {
        v.midiInstrumentId = i.MidiInstrumentId;
      }
    }
  }
  loadInstruments() {
    return __awaiter(this, void 0, void 0, function* () {
      let playerPromises = [];
      for (const i of this.sheet.Instruments) {
        const pbInstrument = this.availableInstruments.find(
          pbi => pbi.midiId === i.MidiInstrumentId
        );
        if (pbInstrument == null) {
          this.fallbackToPiano(i);
        }
        playerPromises.push(this.instrumentPlayer.load(i.MidiInstrumentId));
      }
      yield Promise.all(playerPromises);
    });
  }
  fallbackToPiano(i) {
    console.warn(
      `Can't find playback instrument for midiInstrumentId ${i.MidiInstrumentId}. Falling back to piano`
    );
    i.MidiInstrumentId = 0;
    if (this.availableInstruments.find(i => i.midiId === 0) == null) {
      throw new Error('Piano fallback failed, grand piano not supported');
    }
  }
  play() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.scheduler) return;
      yield this.ac.resume();
      if (this.state === PlaybackState.PAUSED) {
        this.setState(PlaybackState.PLAYING);
        this.scheduler.resume();
        return;
      }
      if (this.state === PlaybackState.INIT || this.state === PlaybackState.STOPPED) {
        this.cursor.show();
      }
      this.setState(PlaybackState.PLAYING);
      this.scheduler.start();
    });
  }
  stop() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setState(PlaybackState.STOPPED);
      this.stopPlayers();
      this.clearTimeouts();
      this.scheduler.reset();
      this.cursor.reset();
      this.currentIterationStep = 0;
      this.cursor.hide();
    });
  }
  pause() {
    this.setState(PlaybackState.PAUSED);
    if (!this.scheduler) return;
    // Pause the scheduler first to prevent any further scheduling while we suspend the audio context.
    // Avoid rewinding scheduler state here; resume should continue from the same stepQueueIndex/tick.
    this.scheduler.pause();
    this.ac.suspend();
    this.stopPlayers();
    this.clearTimeouts();
  }
  jumpToStep(step) {
    this.pause();
    if (this.currentIterationStep > step) {
      this.cursor.reset();
      this.currentIterationStep = 0;
    }
    while (this.currentIterationStep < step) {
      this.cursor.next();
      ++this.currentIterationStep;
    }
    let schedulerStep = this.currentIterationStep;
    if (this.currentIterationStep > 0 && this.currentIterationStep < this.iterationSteps)
      ++schedulerStep;
    this.scheduler.setIterationStep(schedulerStep);
  }
  setBpm(bpm) {
    console.log(
      '[LocalPlaybackEngine] setBpm',
      JSON.stringify({
        oldBpm: this.playbackSettings.bpm,
        newBpm: bpm,
        timestamp: new Date().toISOString(),
      })
    );
    this.playbackSettings.bpm = bpm;
    if (this.scheduler) this.scheduler.wholeNoteLength = this.wholeNoteLength;
  }
  on(event, cb) {
    this.events.on(event, cb);
  }
  countAndSetIterationSteps() {
    this.cursor.reset();
    let steps = 0;
    while (!this.cursor.Iterator.EndReached) {
      if (this.cursor.Iterator.CurrentVoiceEntries) {
        // Use OSMD's absolute timestamp for the current cursor position to place notes on a real timeline.
        // The previous approach (using "first empty tick") can compress the whole score after tuplets,
        // making minutes of music play in seconds.
        const iterator = this.cursor.Iterator;
        const timeStamp = iterator.CurrentTimeStamp ?? iterator.currentTimeStamp ?? null;
        const timeStampRealValue =
          timeStamp && typeof timeStamp.RealValue === 'number'
            ? timeStamp.RealValue
            : timeStamp && typeof timeStamp.realValue === 'number'
              ? timeStamp.realValue
              : null;

        this.scheduler.loadNotes(this.cursor.Iterator.CurrentVoiceEntries, timeStampRealValue);
      }
      this.cursor.next();
      ++steps;
    }
    this.iterationSteps = steps;
    this.cursor.reset();
  }
  notePlaybackCallback(audioDelay, notes, meta) {
    if (this.state !== PlaybackState.PLAYING) return;

    // Debug: if the scheduler is behind, it will clamp delays to 0 which can make the rest of the song
    // feel permanently too fast (many notes fire back-to-back).
    try {
      const nowMs =
        typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const deltaMs =
        this._debugLastNoteCallbackAtMs != null ? nowMs - this._debugLastNoteCallbackAtMs : null;
      this._debugLastNoteCallbackAtMs = nowMs;

      if (audioDelay <= 0.005) {
        this._debugZeroDelayBursts++;
        console.warn(
          '[LocalPlaybackEngine] anomaly: very small audioDelay',
          JSON.stringify({
            audioDelayMs: Math.round(audioDelay * 1000),
            deltaMs,
            bpm: this.playbackSettings.bpm,
            currentIterationStep: this.currentIterationStep,
            notesCount: notes ? notes.length : 0,
            zeroDelayBursts: this._debugZeroDelayBursts,
            timestamp: new Date().toISOString(),
          })
        );
      } else if (this._debugZeroDelayBursts > 0) {
        // Reset once we return to normal scheduling.
        this._debugZeroDelayBursts = 0;
      }

      // Debug: catch suspiciously short note lengths (can indicate tuplet scaling bugs / lingering tuplet state).
      // This helps when playback "suddenly becomes too fast and stays too fast" without BPM changing.
      if (notes && notes.length) {
        const nonRestNotes = notes.filter(n => n && typeof n.isRest === 'function' && !n.isRest());
        if (nonRestNotes.length) {
          let minReal = Infinity;
          let maxReal = 0;
          for (const n of nonRestNotes) {
            const rv =
              n.Length && typeof n.Length.RealValue === 'number' ? n.Length.RealValue : null;
            if (rv == null) continue;
            minReal = Math.min(minReal, rv);
            maxReal = Math.max(maxReal, rv);
          }
          if (Number.isFinite(minReal) && minReal > 0) {
            const minDurMs = Math.round(minReal * this.wholeNoteLength);
            const maxDurMs = Math.round(maxReal * this.wholeNoteLength);
            // Threshold tuned to catch "everything is suddenly tiny" (e.g., < 80ms at current BPM).
            if (minDurMs < 80) {
              console.warn(
                '[LocalPlaybackEngine] anomaly: very short note duration',
                JSON.stringify({
                  bpm: this.playbackSettings.bpm,
                  wholeNoteLength: this.wholeNoteLength,
                  audioDelayMs: Math.round(audioDelay * 1000),
                  nonRestNotesCount: nonRestNotes.length,
                  minRealValue: minReal,
                  maxRealValue: maxReal,
                  minDurationMs: minDurMs,
                  maxDurationMs: maxDurMs,
                  currentIterationStep: this.currentIterationStep,
                  timestamp: new Date().toISOString(),
                })
              );
            }

            // Targeted debug window around the suspected "jump" (keeps logs readable).
            if (this.currentIterationStep >= 15 && this.currentIterationStep <= 55) {
              const tick = meta && typeof meta.tick === 'number' ? meta.tick : null;
              const stepQueueIndex =
                meta && typeof meta.stepQueueIndex === 'number' ? meta.stepQueueIndex : null;
              const isQuarterBeat = tick != null ? tick % 256 === 0 : null;

              console.log(
                '[LocalPlaybackEngine] debug: timing window',
                JSON.stringify({
                  step: this.currentIterationStep,
                  bpm: this.playbackSettings.bpm,
                  wholeNoteLength: this.wholeNoteLength,
                  audioDelayMs: Math.round(audioDelay * 1000),
                  tick,
                  stepQueueIndex,
                  isQuarterBeat,
                  nonRestNotesCount: nonRestNotes.length,
                  minRealValue: minReal,
                  maxRealValue: maxReal,
                  minDurationMs: minDurMs,
                  maxDurationMs: maxDurMs,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          }
        }
      }
    } catch (e) {
      console.error('[LocalPlaybackEngine] anomaly logging error', e);
    }

    let scheduledNotes = new Map();
    for (let note of notes) {
      if (note.isRest()) {
        continue;
      }
      const noteDuration = getNoteDuration(note, this.wholeNoteLength);
      if (noteDuration === 0) continue;
      const noteVolume = getNoteVolume(note);
      const noteArticulation = getNoteArticulationStyle(note);
      const midiPlaybackInstrument = note.ParentVoiceEntry.ParentVoice.midiInstrumentId;
      const fixedKey = note.ParentVoiceEntry.ParentVoice.Parent.SubInstruments[0].fixedKey || 0;
      if (!scheduledNotes.has(midiPlaybackInstrument)) {
        scheduledNotes.set(midiPlaybackInstrument, []);
      }
      scheduledNotes.get(midiPlaybackInstrument).push({
        note: note.halfTone - fixedKey * 12,
        duration: noteDuration / 1000,
        gain: noteVolume,
        articulation: noteArticulation,
      });
    }
    for (const [midiId, notes] of scheduledNotes) {
      this.instrumentPlayer.schedule(midiId, this.ac.currentTime + audioDelay, notes);
    }
    this.timeoutHandles.push(
      window.setTimeout(() => this.iterationCallback(), Math.max(0, audioDelay * 1000 - 35)), // Subtracting 35 milliseconds to compensate for update delay
      window.setTimeout(() => this.events.emit(PlaybackEvent.ITERATION, notes), audioDelay * 1000)
    );
  }
  setState(state) {
    this.state = state;
    this.events.emit(PlaybackEvent.STATE_CHANGE, state);
  }
  stopPlayers() {
    for (const i of this.sheet.Instruments) {
      for (const v of i.Voices) {
        this.instrumentPlayer.stop(v.midiInstrumentId);
      }
    }
  }
  // Used to avoid duplicate cursor movements after a rapid pause/resume action
  clearTimeouts() {
    for (let h of this.timeoutHandles) {
      clearTimeout(h);
    }
    this.timeoutHandles = [];
  }
  iterationCallback() {
    if (this.state !== PlaybackState.PLAYING) return;
    if (this.currentIterationStep > 0) this.cursor.next();

    try {
      const measureIndex = this.cursor.Iterator.CurrentMeasureIndex;
      const bpm = this.playbackSettings.bpm;
      const voiceEntries = this.cursor.Iterator.CurrentVoiceEntries;

      console.log(
        '[LocalPlaybackEngine] iterationCallback',
        JSON.stringify({
          step: this.currentIterationStep,
          measure: measureIndex,
          bpm: bpm,
          voiceEntriesCount: voiceEntries ? voiceEntries.length : 0,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.error('[LocalPlaybackEngine] Logging error', e);
    }

    ++this.currentIterationStep;
  }
}
