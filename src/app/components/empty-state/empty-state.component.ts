import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  // ============================================================================
  // Input Signals
  // ============================================================================

  /**
   * Primary message to display
   */
  readonly message = input<string>('Your library is empty');

  /**
   * Secondary message/description
   */
  readonly description = input<string>(
    'Upload your own music or browse our public domain collection to get started'
  );

  /**
   * Material icon name to display
   */
  readonly iconName = input<string>('queue_music');
}
