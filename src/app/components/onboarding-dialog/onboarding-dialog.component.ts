import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatStepper, MatStep, MatStepperNext, MatStepperPrevious } from '@angular/material/stepper';

import { ProfileService } from '@/app/services/profile.service';

@Component({
  selector: 'app-onboarding-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MatStepper,
    MatStep,
    MatStepperNext,
    MatStepperPrevious,
  ],
  templateUrl: './onboarding-dialog.component.html',
  styleUrl: './onboarding-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<OnboardingDialogComponent>);
  private readonly profileService = inject(ProfileService);

  // ============================================================================
  // State Signals
  // ============================================================================

  readonly isCompleting = signal<boolean>(false);

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Complete onboarding and close dialog
   */
  async onClose(): Promise<void> {
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
}
