import StepQueue from './internals/StepQueue';
export default class PlaybackScheduler {
  constructor(wholeNoteLength, audioContext, noteSchedulingCallback) {
    this.stepQueue = new StepQueue();
    this.stepQueueIndex = 0;
    this.scheduledTicks = new Set();
    this.currentTick = 0;
    this.currentTickTimestamp = 0;
    this.audioContextStartTime = 0;
    this.schedulerIntervalHandle = null;
    this.scheduleInterval = 200; // Milliseconds
    this.schedulePeriod = 500;
    this.tickDenominator = 1024;
    this.lastTickOffset = 300; // Hack to get the initial notes play better
    this.playing = false;
    this.noteSchedulingCallback = noteSchedulingCallback;
    this.wholeNoteLength = wholeNoteLength;
    this.audioContext = audioContext;

    // Debug counters to detect scheduler anomalies like "catch-up" bursts (many 0-delay schedules)
    // or duplicate interval timers (which can make playback sound permanently too fast).
    this._debugId = Math.random().toString(36).slice(2, 8);
    this._debugIntervalHandles = new Set();
    this._debugLastScheduleCallAtMs = null;
    this._debugScheduleCallCount = 0;
  }
  get schedulePeriodTicks() {
    return this.schedulePeriod / this.tickDuration;
  }
  get audioContextTime() {
    if (!this.audioContext) return 0;
    return (this.audioContext.currentTime - this.audioContextStartTime) * 1000;
  }
  get tickDuration() {
    return this.wholeNoteLength / this.tickDenominator;
  }
  get calculatedTick() {
    return (
      this.currentTick +
      Math.round((this.audioContextTime - this.currentTickTimestamp) / this.tickDuration)
    );
  }
  start() {
    this.stepQueue.sort();
    if (!this.schedulerIntervalHandle) {
      this.playing = true;
      // Fresh start: reset timebase relative to "now".
      this.audioContextStartTime = this.audioContext.currentTime;
      this.currentTickTimestamp = this.audioContextTime;
      this.schedulerIntervalHandle = window.setInterval(
        () => this.scheduleIterationStep(),
        this.scheduleInterval
      );
      this._debugIntervalHandles.add(this.schedulerIntervalHandle);
      try {
        console.log(
          '[LocalPlaybackScheduler] start',
          JSON.stringify({
            id: this._debugId,
            createdIntervalHandle: this.schedulerIntervalHandle,
            knownIntervalHandles: Array.from(this._debugIntervalHandles),
            scheduleInterval: this.scheduleInterval,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (e) {
        console.error('[LocalPlaybackScheduler] start logging error', e);
      }
      return;
    }
    // If we're already running an interval (e.g. resume after pause), do NOT reset the timebase.
    // Just resume scheduling from the current tick/stepQueueIndex.
    this.playing = true;
    this.currentTickTimestamp = this.audioContextTime;
  }
  setIterationStep(step) {
    step = Math.min(this.stepQueue.steps.length - 1, step);
    this.stepQueueIndex = step;
    this.currentTick = this.stepQueue.steps[this.stepQueueIndex].tick;
  }
  pause() {
    this.playing = false;
    // Any notes scheduled in the audio engine are cancelled by the caller (PlaybackEngine.stopPlayers()).
    // Clear our "already scheduled" bookkeeping so resume can re-schedule cleanly.
    this.scheduledTicks.clear();
  }
  resume() {
    this.playing = true;
    this.currentTickTimestamp = this.audioContextTime;
  }
  reset() {
    this.playing = false;
    this.currentTick = 0;
    this.currentTickTimestamp = 0;
    this.stepQueueIndex = 0;
    this.audioContextStartTime = 0;
    this.scheduledTicks.clear();
    // IMPORTANT: clear the *interval handle*, not the interval duration.
    // Failing to do this can leave orphaned intervals running and cause multiple
    // schedulers to run concurrently after stop/start cycles (perceived tempo increase).
    for (const handle of this._debugIntervalHandles) {
      clearInterval(handle);
    }
    this._debugIntervalHandles.clear();
    this.schedulerIntervalHandle = null;
  }
  loadNotes(currentVoiceEntries, timeStampRealValue) {
    // Prefer scheduling based on OSMD's absolute cursor timestamp.
    // This prevents time compression bugs where subsequent cursor steps get placed
    // at the earliest "empty" tick (e.g., after tuplets), making playback run far too fast.
    let thisTick = this.lastTickOffset;
    if (typeof timeStampRealValue === 'number' && Number.isFinite(timeStampRealValue)) {
      thisTick = this.lastTickOffset + Math.round(timeStampRealValue * this.tickDenominator);
    } else if (this.stepQueue.steps.length > 0) {
      // Fallback to legacy behavior if timestamp isn't available.
      thisTick = this.stepQueue.getFirstEmptyTick();
    }
    for (let entry of currentVoiceEntries) {
      if (!entry.IsGrace) {
        for (let note of entry.Notes) {
          this.stepQueue.addNote(thisTick, note);
          // Legacy scheduling created extra "empty" steps at note ends to find the next tick.
          // With absolute timestamps, these empty steps are unnecessary and can create many
          // redundant scheduler callbacks.
          if (!(typeof timeStampRealValue === 'number' && Number.isFinite(timeStampRealValue))) {
            this.stepQueue.createStep(thisTick + note.Length.RealValue * this.tickDenominator);
          }
        }
      }
    }
  }
  scheduleIterationStep() {
    var _a, _b;
    if (!this.playing) return;

    // Detect duplicate timers or unusually frequent scheduler invocations.
    // When this happens, playback can "ramp" and stay too fast because stepQueueIndex advances too quickly.
    const nowMs =
      typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    if (this._debugLastScheduleCallAtMs != null) {
      const deltaMs = nowMs - this._debugLastScheduleCallAtMs;
      // If we fire far more often than our schedule interval, it's a strong indicator of duplicate intervals.
      if (deltaMs < this.scheduleInterval * 0.75) {
        try {
          console.warn(
            '[LocalPlaybackScheduler] anomaly: scheduleIterationStep called too frequently',
            JSON.stringify({
              id: this._debugId,
              deltaMs,
              scheduleInterval: this.scheduleInterval,
              schedulerIntervalHandle: this.schedulerIntervalHandle,
              knownIntervalHandles: Array.from(this._debugIntervalHandles),
              timestamp: new Date().toISOString(),
            })
          );
        } catch (e) {
          console.error('[LocalPlaybackScheduler] anomaly logging error', e);
        }
      }
    }
    this._debugLastScheduleCallAtMs = nowMs;
    this._debugScheduleCallCount++;

    const audioContextTimeBefore = this.audioContextTime;
    const currentTickTimestampBefore = this.currentTickTimestamp;
    const currentTickBefore = this.currentTick;
    this.currentTick = this.calculatedTick;
    this.currentTickTimestamp = audioContextTimeBefore;

    try {
      console.log(
        '[LocalPlaybackScheduler] scheduleIterationStep',
        JSON.stringify({
          currentTick: this.currentTick,
          tickDuration: this.tickDuration,
          wholeNoteLength: this.wholeNoteLength,
          stepQueueIndex: this.stepQueueIndex,
          audioContextTime: audioContextTimeBefore,
          currentTickTimestamp: currentTickTimestampBefore,
          previousTick: currentTickBefore,
          calculatedTickAdvance: this.currentTick - currentTickBefore,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.error('[LocalPlaybackScheduler] Logging error', e);
    }

    let nextTick =
      (_a = this.stepQueue.steps[this.stepQueueIndex]) === null || _a === void 0 ? void 0 : _a.tick;
    let scheduledSteps = 0;
    let clampedToZeroCount = 0;
    let mostNegativeTimeToTick = 0;
    while (this.nextTickAvailableAndWithinSchedulePeriod(nextTick)) {
      let step = this.stepQueue.steps[this.stepQueueIndex];
      let timeToTick = (step.tick - this.currentTick) * this.tickDuration;
      if (timeToTick < 0) {
        clampedToZeroCount++;
        mostNegativeTimeToTick = Math.min(mostNegativeTimeToTick, timeToTick);
        timeToTick = 0;
      }
      this.scheduledTicks.add(step.tick);
      this.noteSchedulingCallback(timeToTick / 1000, step.notes, {
        tick: step.tick,
        stepQueueIndex: this.stepQueueIndex,
      });
      this.stepQueueIndex++;
      scheduledSteps++;
      nextTick =
        (_b = this.stepQueue.steps[this.stepQueueIndex]) === null || _b === void 0
          ? void 0
          : _b.tick;
    }

    // Log only when we see "catch-up" scheduling, which can sound like a sudden tempo increase.
    if (clampedToZeroCount > 0 || scheduledSteps > 12) {
      try {
        console.warn(
          '[LocalPlaybackScheduler] anomaly: catch-up scheduling',
          JSON.stringify({
            id: this._debugId,
            scheduledSteps,
            clampedToZeroCount,
            mostNegativeTimeToTickMs: mostNegativeTimeToTick,
            currentTick: this.currentTick,
            stepQueueIndex: this.stepQueueIndex,
            tickDuration: this.tickDuration,
            wholeNoteLength: this.wholeNoteLength,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (e) {
        console.error('[LocalPlaybackScheduler] anomaly logging error', e);
      }
    }

    // Targeted debug window around the suspected area. This is intentionally verbose but bounded.
    if (this.stepQueueIndex >= 15 && this.stepQueueIndex <= 80) {
      try {
        console.log(
          '[LocalPlaybackScheduler] debug: stepQueue window',
          JSON.stringify({
            id: this._debugId,
            stepQueueIndex: this.stepQueueIndex,
            scheduledSteps,
            clampedToZeroCount,
            mostNegativeTimeToTickMs: mostNegativeTimeToTick,
            currentTick: this.currentTick,
            tickDuration: this.tickDuration,
            wholeNoteLength: this.wholeNoteLength,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (e) {
        console.error('[LocalPlaybackScheduler] debug logging error', e);
      }
    }
    for (let tick of this.scheduledTicks) {
      if (tick <= this.currentTick) {
        this.scheduledTicks.delete(tick);
      }
    }
  }
  nextTickAvailableAndWithinSchedulePeriod(nextTick) {
    return (
      nextTick &&
      this.currentTickTimestamp + (nextTick - this.currentTick) * this.tickDuration <=
        this.currentTickTimestamp + this.schedulePeriod
    );
  }
}
