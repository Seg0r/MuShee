import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  viewChild,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatDrawer } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { OnboardingDialogComponent } from '../onboarding-dialog/onboarding-dialog.component';
import { ProfileService } from '../../services/profile.service';
import type { ProfileDto } from '@/types';

/**
 * Main shell layout component for authenticated views.
 * Provides persistent navigation, toolbar with user menu, and content area.
 * Responsive design: sidebar on desktop, drawer on mobile.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    MatDialogModule,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'onWindowResize()',
  },
})
export class AppShellComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly drawer = viewChild<MatDrawer>('drawer');

  /**
   * User profile for onboarding status check
   */
  private readonly userProfile = signal<ProfileDto | null>(null);

  /**
   * Track if current view is mobile
   */
  private readonly isMobileViewSignal = signal<boolean>(this.checkMobileView());

  /**
   * Expose auth service signals to template
   */
  readonly user = this.authService.user;
  readonly isAuthenticated = this.authService.isAuthenticated;

  /**
   * Get user email for display in menu
   */
  readonly userEmail = () => this.authService.getUserEmail();

  ngOnInit(): void {
    this.loadUserProfile();
  }

  /**
   * Loads user profile to check onboarding status
   * Auto-triggers onboarding dialog if incomplete and on library view
   */
  private loadUserProfile(): void {
    this.profileService
      .getCurrentUserProfile()
      .then((profile: ProfileDto) => {
        this.userProfile.set(profile);
      })
      .catch((error: unknown) => {
        console.error('Failed to load profile:', error);
      });
  }

  /**
   * Navigates to a route and closes drawer on mobile
   */
  onNavigation(path: string): void {
    this.router.navigate([path]);
    // Close drawer on mobile after navigation
    const drawer = this.drawer();
    if (drawer && this.isMobileViewSignal()) {
      drawer.close();
    }
  }

  /**
   * Toggles the drawer (mobile only)
   */
  toggleDrawer(): void {
    const drawer = this.drawer();
    if (drawer) {
      drawer.toggle();
    }
  }

  /**
   * Checks if the current view is mobile (< 960px)
   */
  isMobileView(): boolean {
    return this.isMobileViewSignal();
  }

  /**
   * Handles window resize event
   */
  onWindowResize(): void {
    const wasMobile = this.isMobileViewSignal();
    const isMobileNow = this.checkMobileView();

    // Update mobile view signal
    this.isMobileViewSignal.set(isMobileNow);

    // If transitioning from mobile to desktop, close drawer
    const drawer = this.drawer();
    if (drawer && wasMobile && !isMobileNow && drawer.opened) {
      drawer.close();
    }
  }

  /**
   * Helper to check mobile view
   */
  private checkMobileView(): boolean {
    return window.innerWidth < 960;
  }

  /**
   * Opens onboarding dialog (re-accessible from help menu)
   */
  onHelpClick(): void {
    this.dialog.open(OnboardingDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      disableClose: false,
    });
  }

  /**
   * Opens logout confirmation dialog
   */
  onLogoutClick(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      maxWidth: '90vw',
      data: {
        title: 'Logout?',
        message: 'Are you sure you want to log out?',
        confirmText: 'Logout',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.authService.logout();
      }
    });
  }

  /**
   * Check if current route is active
   */
  isRouteActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }
}
