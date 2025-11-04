import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { SongService } from '@/app/services/song.service';
import { FileUtilsService } from '@/app/services/file-utils.service';

interface UploadDialogResult {
  success: boolean;
  response?: unknown;
}

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIcon,
    MatProgressSpinner,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
  ],
  templateUrl: './upload-dialog.component.html',
  styleUrl: './upload-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadDialogComponent {
  private readonly songService = inject(SongService);
  private readonly fileUtilsService = inject(FileUtilsService);
  private readonly dialogRef = inject(MatDialogRef<UploadDialogComponent>);

  private readonly fileInput = viewChild<HTMLInputElement>('fileInput');

  // ============================================================================
  // State Signals
  // ============================================================================

  private readonly selectedFile = signal<File | null>(null);
  readonly uploadLoading = signal<boolean>(false);
  readonly validationError = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<boolean>(false);
  readonly isDragOver = signal<boolean>(false);

  // ============================================================================
  // Computed Signals
  // ============================================================================

  readonly hasFile = computed(() => this.selectedFile() !== null);
  readonly canUpload = computed(
    () => this.hasFile() && !this.uploadLoading() && !this.validationError()
  );
  readonly isProcessing = computed(
    () => this.uploadLoading() || (this.uploadSuccess() && !this.uploadError())
  );
  readonly fileName = computed(() => this.selectedFile()?.name ?? '');
  readonly fileSize = computed(() => {
    const file = this.selectedFile();
    if (!file) return '';
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return `${sizeMB} MB`;
  });
  readonly maxFileSize = computed(() => {
    const maxBytes = this.fileUtilsService.getMaxFileSize();
    return `${Math.round(maxBytes / (1024 * 1024))} MB`;
  });
  readonly allowedExtensions = computed(() =>
    this.fileUtilsService.getAllowedExtensions().join(', ')
  );

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Open native file selector
   */
  onClickFileInput(): void {
    this.fileInput()?.click();
  }

  /**
   * Handle file selection from input element
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.handleFileSelection(file);
    }
  }

  /**
   * Handle drag over event - highlight drop zone
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  /**
   * Handle drag leave event - remove highlight
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  /**
   * Handle drop event - process dropped file
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFileSelection(file);
    }
  }

  /**
   * Upload the selected file
   */
  async onUpload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.uploadLoading.set(true);
    this.uploadError.set(null);

    try {
      const response = await this.songService.uploadSong({ file });
      this.uploadSuccess.set(true);

      // Close dialog after brief delay to show success state
      setTimeout(() => {
        this.dialogRef.close({ success: true, response } as UploadDialogResult);
      }, 500);
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.uploadError.set(errorMessage);
      this.uploadLoading.set(false);
    }
  }

  /**
   * Clear selected file and errors
   */
  onClearFile(): void {
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.uploadError.set(null);
    this.uploadSuccess.set(false);

    // Reset file input
    const input = this.fileInput();
    if (input) {
      input.value = '';
    }
  }

  /**
   * Close dialog
   */
  onClose(): void {
    this.dialogRef.close();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handle file selection with validation
   */
  private handleFileSelection(file: File): void {
    this.selectedFile.set(file);
    this.validationError.set(null);
    this.uploadError.set(null);

    // Validate file
    const validationError = this.validateFile(file);
    if (validationError) {
      this.validationError.set(validationError);
      this.selectedFile.set(null);
      return;
    }

    // File is valid
    this.validationError.set(null);
  }

  /**
   * Validate file with all checks
   */
  private validateFile(file: File): string | null {
    // Check extension
    if (!this.fileUtilsService.validateFileExtension(file.name)) {
      return `Invalid file format. Supported formats: ${this.allowedExtensions()}`;
    }

    // Check size
    if (!this.fileUtilsService.validateFileSize(file.size)) {
      return `File size exceeds maximum allowed size of ${this.maxFileSize()}`;
    }

    // Check MIME type
    if (!this.fileUtilsService.validateMimeType(file.type)) {
      return `Invalid file type: ${file.type}. Expected XML content.`;
    }

    return null;
  }

  /**
   * Extract user-friendly error message from error object
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Check for specific application errors
      if ('code' in error) {
        const errorCode = (error as Record<string, unknown>)['code'];
        switch (errorCode) {
          case 'INVALID_FILE_FORMAT':
            return 'Invalid file format. Only MusicXML files (.xml, .musicxml) are supported.';
          case 'FILE_TOO_LARGE':
            return `File size exceeds maximum allowed size of ${this.maxFileSize()}`;
          case 'INVALID_MUSICXML':
            return 'Invalid MusicXML format. Please ensure the file is valid.';
          case 'SONG_ALREADY_IN_LIBRARY':
            return 'This song is already in your library.';
          case 'CONFLICT':
            return error.message;
          default:
            return error.message || 'Upload failed. Please try again.';
        }
      }
      return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
