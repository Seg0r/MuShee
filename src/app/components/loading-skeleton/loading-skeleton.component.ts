import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSkeletonComponent {
  // ============================================================================
  // Input Signals
  // ============================================================================

  /**
   * Number of skeleton cards to display
   */
  readonly count = input<number>(8);

  /**
   * Number of rows in grid
   */
  readonly rows = input<number>(2);

  /**
   * Number of columns in grid
   */
  readonly cols = input<number>(4);

  // ============================================================================
  // Computed Signals
  // ============================================================================

  /**
   * Array of skeleton items
   */
  readonly skeletonItems = computed(() => {
    return Array.from({ length: this.count() }, (_, i) => i);
  });
}
