import { Component, ChangeDetectionStrategy, TemplateRef, input, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatIcon],
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

  private readonly template = viewChild<TemplateRef<void>>('emptyStateTemplate');

  /**
   * Exposes the rendered template so feature components can pass it down
   * to collection views without repeating the markup.
   */
  templateRef(): TemplateRef<void> | null {
    return this.template() ?? null;
  }
}
