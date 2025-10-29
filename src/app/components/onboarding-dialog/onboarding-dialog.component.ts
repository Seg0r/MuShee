import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';

import { ProfileService } from '@/app/services/profile.service';

@Component({
  selector: 'app-onboarding-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatStepperModule],
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

  readonly currentStep = signal<number>(0);
  readonly isCompleting = signal<boolean>(false);

  // ============================================================================
  // Computed Signals
  // ============================================================================

  readonly isFirstStep = computed(() => this.currentStep() === 0);
  readonly isLastStep = computed(() => this.currentStep() === 2);
  readonly canProceed = computed(() => !this.isCompleting());

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Move to next step
   */
  onNext(): void {
    if (this.currentStep() < 2) {
      this.currentStep.set(this.currentStep() + 1);
    }
  }

  /**
   * Move to previous step
   */
  onBack(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  /**
   * Complete onboarding
   */
  async onGetStarted(): Promise<void> {
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
      // Don't show error to user, allow them to retry or close dialog
    }
  }

  /**
   * Close dialog
   */
  onClose(): void {
    this.dialogRef.close({ success: false });
  }

  /**
   * Get step title
   */
  getStepTitle(): string {
    const titles = ['Upload Your Music', 'Browse Public Library', 'Get AI Recommendations'];
    return titles[this.currentStep()];
  }

  /**
   * Get step description
   */
  getStepDescription(): string {
    const descriptions = [
      'Upload your MusicXML files to build your personal sheet music library. Our platform supports standard MusicXML format files.',
      'Explore our collection of public domain compositions. Discover new pieces to add to your library.',
      'Let AI analyze your music collection and suggest similar pieces you might enjoy. Powered by advanced music understanding.',
    ];
    return descriptions[this.currentStep()];
  }

  /**
   * Get step icon
   */
  getStepIcon(): string {
    const icons = ['cloud_upload', 'library_music', 'smart_toy'];
    return icons[this.currentStep()];
  }

  /**
   * Get step action text
   */
  getStepActionText(): string {
    const actions = ['Upload a Song', 'Browse Library', 'Find Similar Music'];
    return actions[this.currentStep()];
  }
}
