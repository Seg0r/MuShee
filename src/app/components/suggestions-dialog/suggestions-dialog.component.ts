import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogContent,
  MatDialogActions,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatList, MatListItem } from '@angular/material/list';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';

import type { GenerateAiSuggestionsResponseDto } from '@/types';

export interface SuggestionsDialogData {
  suggestions: GenerateAiSuggestionsResponseDto | null;
  isLoading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-suggestions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButton,
    MatList,
    MatListItem,
    MatProgressSpinner,
    MatIcon,
    MatDialogContent,
    MatDialogActions,
  ],
  templateUrl: './suggestions-dialog.component.html',
  styleUrls: ['./suggestions-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionsDialogComponent {
  readonly dialogRef = inject(MatDialogRef<SuggestionsDialogComponent>);
  private readonly data: SuggestionsDialogData = inject(MAT_DIALOG_DATA);

  readonly suggestions = signal<GenerateAiSuggestionsResponseDto | null>(this.data.suggestions);
  readonly isLoading = signal<boolean>(this.data.isLoading);
  readonly error = signal<string | null>(this.data.error);

  onClose(): void {
    this.dialogRef.close();
  }
}
