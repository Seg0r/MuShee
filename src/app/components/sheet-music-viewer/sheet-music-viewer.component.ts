import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ElementRef,
  viewChild,
  effect,
  ChangeDetectionStrategy,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { OpenSheetMusicDisplay, IOSMDOptions } from 'opensheetmusicdisplay';

import { SongService } from '../../services/song.service';
import { FeedbackService } from '../../services/feedback.service';
import { AuthService } from '../../services/auth.service';
import type { SongAccessDto } from '../../../types';

/**
 * Sheet music viewer component for displaying rendered MusicXML files.
 * Provides full-screen viewing experience with zoom controls and feedback collection.
 * No shell layout - takes up entire viewport for maximum readability.
 */
@Component({
  selector: 'app-sheet-music-viewer',
  standalone: true,
  imports: [CommonModule, MatIcon, MatButtonModule, MatProgressSpinner],
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

  // OSMD instance
  private osmd: OpenSheetMusicDisplay | null = null;

  // Expose authentication status to template
  readonly isUserAuthenticated = this.authService.isAuthenticated;

  // Constants
  private readonly ZOOM_STEP = 0.1;
  private readonly MIN_ZOOM = 0.5;
  private readonly MAX_ZOOM = 2.0;

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
      } as IOSMDOptions);

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
    } catch (error) {
      console.error('Failed to render sheet music:', error);
      throw new Error('Failed to render sheet music. The file may be corrupted or unsupported.');
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
}
