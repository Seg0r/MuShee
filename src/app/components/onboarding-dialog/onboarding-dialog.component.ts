import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatStepper, MatStep, MatStepperNext, MatStepperPrevious } from '@angular/material/stepper';

import { ProfileService } from '@/app/services/profile.service';

export interface OnboardingDialogData {
  mode?: 'authenticated' | 'anonymous';
}

@Component({
  selector: 'app-onboarding-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIcon,
    MatStepper,
    MatStep,
    MatStepperNext,
    MatStepperPrevious,
    MatDialogTitle,
    MatDialogContent,
  ],
  templateUrl: './onboarding-dialog.component.html',
  styleUrl: './onboarding-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<OnboardingDialogComponent>);
  private readonly profileService = inject(ProfileService);
  private readonly dialogData = inject<OnboardingDialogData>(MAT_DIALOG_DATA, { optional: true });

  // ============================================================================
  // State Signals
  // ============================================================================

  readonly isCompleting = signal<boolean>(false);
  readonly mode = signal<'authenticated' | 'anonymous'>(this.dialogData?.mode ?? 'authenticated');

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Complete onboarding and close dialog
   */
  async onClose(): Promise<void> {
    const currentMode = this.mode();

    // For anonymous users, just close and mark as seen in localStorage
    if (currentMode === 'anonymous') {
      try {
        localStorage.setItem('mushee-anonymous-onboarding-seen', 'true');
      } catch (error) {
        console.warn('Failed to save anonymous onboarding state:', error);
      }
      this.dialogRef.close({ success: true });
      return;
    }

    // For authenticated users, update profile
    this.isCompleting.set(true);

    try {
      await this.profileService.updateCurrentUserProfile({
        has_completed_onboarding: true,
      });
      this.dialogRef.close({ success: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete onboarding';
      console.error('Onboarding completion error:', errorMessage);
      this.isCompleting.set(false);
      // Don't show error to user, allow them to close or retry via X button
    }
  }

  /**
   * Navigate to registration page
   */
  navigateToRegister(): void {
    this.dialogRef.close({ navigateTo: '/register' });
  }
}
