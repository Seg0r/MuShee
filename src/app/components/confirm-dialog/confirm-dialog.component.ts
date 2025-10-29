import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface ConfirmDialogData {
  title: string;
  message: string;
  itemDetails: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Handle confirm button click
   */
  onConfirm(): void {
    this.dialogRef.close(true);
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    this.dialogRef.close(false);
  }

  /**
   * Get button color class for styling
   */
  getButtonColorClass(): string {
    const color = this.data.confirmColor || 'warn';
    return `button-${color}`;
  }

  /**
   * Get confirm button text
   */
  getConfirmText(): string {
    return this.data.confirmText || 'Delete';
  }

  /**
   * Get cancel button text
   */
  getCancelText(): string {
    return this.data.cancelText || 'Cancel';
  }
}
