import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OpenSheetMusicDisplay, IOSMDOptions } from 'opensheetmusicdisplay';
import PlaybackEngine from 'osmd-audio-player';

// PlaybackState and PlaybackEvent are not re-exported from index, define locally
enum PlaybackState {
  INIT = 'INIT',
  PLAYING = 'PLAYING',
  STOPPED = 'STOPPED',
  PAUSED = 'PAUSED',
}

enum PlaybackEvent {
  STATE_CHANGE = 'state-change',
  ITERATION = 'iteration',
}

import { SongService } from '../../services/song.service';
import { FeedbackService } from '../../services/feedback.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import type { SongAccessDto } from '../../../types';

/**
 * Sheet music viewer component for displaying rendered MusicXML files.
 * Provides full-screen viewing experience with zoom controls and feedback collection.
 * No shell layout - takes up entire viewport for maximum readability.
 */
@Component({
  selector: 'app-sheet-music-viewer',
  imports: [
    CommonModule,
    MatIcon,
    MatButtonModule,
    MatProgressSpinner,
    MatSliderModule,
    MatTooltipModule,
  ],
  templateUrl: './sheet-music-viewer.component.html',
  styleUrl: './sheet-music-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetMusicViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly songService = inject(SongService);
  private readonly feedbackService = inject(FeedbackService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  // View children references
  readonly osmdContainer = viewChild<ElementRef<HTMLDivElement>>('osmdContainer');

  // Signals for component state
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly zoomLevel = signal(1.0);
  readonly renderingFeedback = signal<'thumbs_up' | 'thumbs_down' | null>(null);

  // Song data
  readonly song = signal<SongAccessDto | null>(null);
  readonly songId = signal<string>('');

  // OSMD state - use signal to enable reactive tracking in effects
  readonly osmdReady = signal(false);

  // Playback state signals
  readonly playbackState = signal<PlaybackState>(PlaybackState.INIT);
  readonly isPlaybackLoading = signal(false);
  readonly playbackReady = signal(false);
  readonly currentBpm = signal(120);
  readonly playbackProgress = signal(0);
  readonly totalSteps = signal(0);

  // Computed playback state helpers
  readonly isPlaying = computed(() => this.playbackState() === PlaybackState.PLAYING);
  readonly isPaused = computed(() => this.playbackState() === PlaybackState.PAUSED);
  readonly isStopped = computed(
    () =>
      this.playbackState() === PlaybackState.STOPPED || this.playbackState() === PlaybackState.INIT
  );
  readonly canPlay = computed(() => this.playbackReady() && !this.isPlaying());
  readonly canPause = computed(() => this.isPlaying());
  readonly canStop = computed(() => !this.isStopped());

  // OSMD instance
  private osmd: OpenSheetMusicDisplay | null = null;

  // Playback engine instance
  private playbackEngine: PlaybackEngine | null = null;

  // Expose authentication status to template
  readonly isUserAuthenticated = this.authService.isAuthenticated;

  // Constants
  private readonly ZOOM_STEP = 0.1;
  private readonly MIN_ZOOM = 0.5;
  private readonly MAX_ZOOM = 2.0;
  private readonly DEFAULT_BPM = 120;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 240;

  private osmdInitialized = false;

  constructor() {
    // Effect to load song when songId changes (after OSMD initialization)
    // This effect will run whenever songId or osmdReady signals change
    effect(() => {
      const id = this.songId();
      const ready = this.osmdReady();
      // Only load if we have an ID and OSMD is initialized
      if (id && ready) {
        this.loadSong(id);
      }
    });

    // Effect to update OSMD dark mode when theme changes
    effect(() => {
      const isDarkMode = this.themeService.isDarkMode();
      if (this.osmd) {
        this.updateOSMDTheme(isDarkMode);
      }
    });
  }

  ngOnInit(): void {
    // Read the route parameter and set it as the songId signal
    // This will trigger the effect to load the song (once OSMD is ready)
    const routeSongId = this.route.snapshot.params['songId'];
    if (routeSongId) {
      this.songId.set(routeSongId);
    }
  }

  ngAfterViewInit(): void {
    // Initialize OSMD instance after view is rendered and available
    // Use setTimeout to ensure the DOM is fully rendered in the next tick
    setTimeout(() => {
      this.initializeOSMD();
      this.osmdInitialized = true;
      // Signal to effect that OSMD is ready - this will trigger the effect to run
      this.osmdReady.set(true);
    }, 0);
  }

  ngOnDestroy(): void {
    // Cleanup playback engine first
    if (this.playbackEngine) {
      this.playbackEngine.stop();
      this.playbackEngine = null;
    }

    // Cleanup OSMD instance
    if (this.osmd) {
      this.osmd.clear();
      this.osmd = null;
    }
  }

  /**
   * Navigates back to the previous view (library or discover)
   */
  onBackClick(): void {
    // Navigate back in history, which should preserve the previous route context
    window.history.back();
  }

  /**
   * Increases zoom level
   */
  onZoomIn(): void {
    const newZoom = Math.min(this.zoomLevel() + this.ZOOM_STEP, this.MAX_ZOOM);
    this.setZoom(newZoom);
  }

  /**
   * Decreases zoom level
   */
  onZoomOut(): void {
    const newZoom = Math.max(this.zoomLevel() - this.ZOOM_STEP, this.MIN_ZOOM);
    this.setZoom(newZoom);
  }

  /**
   * Submits thumbs up feedback for rendering quality
   */
  async onThumbsUp(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.showSignInPrompt();
      return;
    }

    try {
      await this.feedbackService.submitRenderingFeedback({
        song_id: this.songId(),
        rating: 1,
      });
      this.renderingFeedback.set('thumbs_up');
      this.showFeedbackConfirmation('Thanks for the positive feedback!');
    } catch (error) {
      console.error('Failed to submit thumbs up feedback:', error);
      this.showError('Failed to submit feedback. Please try again.');
    }
  }

  /**
   * Submits thumbs down feedback for rendering quality
   */
  async onThumbsDown(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.showSignInPrompt();
      return;
    }

    try {
      await this.feedbackService.submitRenderingFeedback({
        song_id: this.songId(),
        rating: -1,
      });
      this.renderingFeedback.set('thumbs_down');
      this.showFeedbackConfirmation(
        "Thanks for the feedback! We'll work on improving the rendering."
      );
    } catch (error) {
      console.error('Failed to submit thumbs down feedback:', error);
      this.showError('Failed to submit feedback. Please try again.');
    }
  }

  /**
   * Checks if zoom in is available
   */
  canZoomIn(): boolean {
    return this.zoomLevel() < this.MAX_ZOOM;
  }

  /**
   * Checks if zoom out is available
   */
  canZoomOut(): boolean {
    return this.zoomLevel() > this.MIN_ZOOM;
  }

  /**
   * Gets formatted zoom level for display
   */
  getZoomDisplay(): string {
    return `${Math.round(this.zoomLevel() * 100)}%`;
  }

  // ========== Playback Controls ==========

  /**
   * Starts or resumes playback
   */
  async onPlay(): Promise<void> {
    if (!this.playbackEngine || !this.playbackReady()) {
      return;
    }

    try {
      await this.playbackEngine.play();
    } catch (error) {
      console.error('Failed to start playback:', error);
      this.showError('Failed to start playback. Please try again.');
    }
  }

  /**
   * Pauses playback
   */
  onPause(): void {
    if (!this.playbackEngine) {
      return;
    }

    try {
      this.playbackEngine.pause();
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  }

  /**
   * Stops playback and resets to beginning
   */
  async onStop(): Promise<void> {
    if (!this.playbackEngine) {
      return;
    }

    try {
      await this.playbackEngine.stop();
      this.playbackProgress.set(0);
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  }

  /**
   * Toggles between play and pause
   */
  async onPlayPauseToggle(): Promise<void> {
    if (this.isPlaying()) {
      this.onPause();
    } else {
      await this.onPlay();
    }
  }

  /**
   * Updates the BPM (tempo) for playback
   */
  onBpmChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const bpm = parseInt(input.value, 10);
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      this.currentBpm.set(bpm);
      if (this.playbackEngine) {
        this.playbackEngine.setBpm(bpm);
      }
    }
  }

  /**
   * Gets the minimum BPM value
   */
  getMinBpm(): number {
    return this.MIN_BPM;
  }

  /**
   * Gets the maximum BPM value
   */
  getMaxBpm(): number {
    return this.MAX_BPM;
  }

  /**
   * Loads song data and renders sheet music
   */
  private async loadSong(songId: string): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Fetch song details and signed URL
      const songData = await this.songService.getSongDetails(songId);
      this.song.set(songData);

      // Render the sheet music
      await this.renderSheetMusic(songData.musicxml_url);
    } catch (error) {
      console.error('Failed to load song:', error);
      this.error.set('Failed to load sheet music. Please try again.');

      // If it's an authorization error, show appropriate message
      if (error instanceof Error && error.message.includes('403')) {
        this.error.set("You don't have permission to view this song.");
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Initializes OpenSheetMusicDisplay instance
   */
  private initializeOSMD(): void {
    const container = this.osmdContainer()?.nativeElement;
    if (!container) {
      console.error('OSMD container not found');
      return;
    }

    try {
      // Create OSMD instance with full rendering options
      const isDarkMode = this.themeService.isDarkMode();
      this.osmd = new OpenSheetMusicDisplay(container, {
        autoResize: true,
        drawingParameters: 'default', // Full quality rendering
        drawTitle: true,
        drawComposer: true,
        drawCredits: true,
        drawPartNames: true,
        drawMeasureNumbers: true,
        drawFingerings: true,
        drawLyrics: true,
        backend: 'svg', // Use SVG for better quality
        darkMode: isDarkMode,
      } as IOSMDOptions);

      this.applyOSMDThemeColors();

      console.log('OSMD initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OSMD:', error);
      this.error.set('Failed to initialize sheet music renderer.');
    }
  }

  /**
   * Renders sheet music from the provided URL
   */
  private async renderSheetMusic(signedUrl: string): Promise<void> {
    if (!this.osmd) {
      throw new Error('OSMD not initialized');
    }

    try {
      // Load the MusicXML from the signed URL
      await this.osmd.load(signedUrl);

      // Render the sheet music
      await this.osmd.render();

      // Set initial zoom
      this.setZoom(this.zoomLevel());

      console.log('Sheet music rendered successfully');

      // Initialize playback engine after rendering
      await this.initializePlayback();
    } catch (error) {
      console.error('Failed to render sheet music:', error);
      throw new Error('Failed to render sheet music. The file may be corrupted or unsupported.');
    }
  }

  /**
   * Initializes the playback engine for audio playback
   */
  private async initializePlayback(): Promise<void> {
    if (!this.osmd) {
      console.warn('Cannot initialize playback: OSMD not available');
      return;
    }

    try {
      this.isPlaybackLoading.set(true);

      // Create new playback engine instance
      this.playbackEngine = new PlaybackEngine();

      // Set up event listeners
      this.playbackEngine.on(PlaybackEvent.STATE_CHANGE, (state: PlaybackState) => {
        this.playbackState.set(state);
        this.cdr.markForCheck();
      });

      this.playbackEngine.on(PlaybackEvent.ITERATION, (data: { iterationStep: number }) => {
        this.playbackProgress.set(data.iterationStep);
        this.cdr.markForCheck();
      });

      // Load the score into the playback engine
      // Use type assertion to handle version mismatch between OSMD versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.playbackEngine.loadScore(this.osmd as any);

      // Set initial BPM
      this.playbackEngine.setBpm(this.currentBpm());

      this.playbackReady.set(true);
      console.log('Playback engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize playback engine:', error);
      // Don't show error to user - playback is optional feature
      // Just log it and continue without playback
      this.playbackReady.set(false);
    } finally {
      this.isPlaybackLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  /**
   * Sets the zoom level for the rendered sheet music
   */
  private setZoom(zoom: number): void {
    if (!this.osmd) return;

    this.zoomLevel.set(zoom);
    this.osmd.Zoom = zoom;
    this.osmd.render(); // Re-render with new zoom level
  }

  /**
   * Shows a sign-in prompt for unauthenticated users
   */
  private showSignInPrompt(): void {
    this.snackBar
      .open('Sign in to rate sheet music rendering', 'Sign In', {
        duration: 5000,
      })
      .onAction()
      .subscribe(() => {
        this.router.navigate(['/login']);
      });
  }

  /**
   * Shows feedback confirmation message
   */
  private showFeedbackConfirmation(message: string): void {
    this.snackBar.open(message, '', {
      duration: 3000,
    });
  }

  /**
   * Shows error message
   */
  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
    });
  }

  /**
   * Updates OSMD dark mode setting when theme changes
   */
  private updateOSMDTheme(isDarkMode: boolean): void {
    if (!this.osmd) return;

    this.osmd.setOptions({ darkMode: isDarkMode });
    this.applyOSMDThemeColors();
    this.osmd.render(); // Re-render with new theme
  }

  private applyOSMDThemeColors(): void {
    if (!this.osmd) return;

    const surfaceColor = this.getCssVariable('--mat-sys-surface') || '#ffffff';
    const onSurfaceColor = this.getCssVariable('--mat-sys-on-surface') || '#000000';

    this.osmd.setOptions({
      defaultColorMusic: onSurfaceColor,
      defaultColorLabel: onSurfaceColor,
      defaultColorTitle: onSurfaceColor,
    });

    const engraving = this.osmd.EngravingRules;
    engraving.PageBackgroundColor = surfaceColor;
    engraving.UsePageBackgroundColorForTabNotes = true;
  }

  private getCssVariable(name: string): string {
    return getComputedStyle(this.document.documentElement).getPropertyValue(name).trim();
  }
}
