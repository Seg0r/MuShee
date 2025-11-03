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
import { MatToolbar } from '@angular/material/toolbar';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatNavList, MatListItem, MatListItemTitle } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuTrigger, MatMenuItem } from '@angular/material/menu';
import { MatDivider } from '@angular/material/divider';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { OnboardingDialogComponent } from '../onboarding-dialog/onboarding-dialog.component';
import { ProfileService } from '../../services/profile.service';
import type { ProfileDto } from '@/types';

interface NavItem {
  icon: string;
  label: string;
  path: string;
  requiresAuth: boolean;
}

/**
 * Main shell layout component for authenticated views.
 * Provides persistent navigation with icon sidebar and drawer labels.
 * Desktop: hover expands drawer with labels and shifts content right
 * Mobile: click icon toggles drawer overlay
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbar,
    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatNavList,
    MatListItem,
    MatListItemTitle,
    MatIcon,
    MatMenu,
    MatMenuTrigger,
    MatMenuItem,
    MatDivider,
    MatSlideToggle,
    MatButton,
    MatIconButton,
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
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly drawer = viewChild<MatSidenav>('drawer');

  /**
   * User profile for onboarding status check
   */
  private readonly userProfile = signal<ProfileDto | null>(null);

  /**
   * Track if current view is mobile
   */
  private readonly isMobileViewSignal = signal<boolean>(this.checkMobileView());

  /**
   * Track if sidebar is hovered (for desktop expand behavior)
   */
  readonly isSidebarHovered = signal<boolean>(false);

  /**
   * Navigation items configuration
   */
  readonly navItems = signal<NavItem[]>([
    {
      icon: 'library_music',
      label: 'My Library',
      path: '/app/library',
      requiresAuth: true,
    },
    {
      icon: 'explore',
      label: 'Discover',
      path: '/app/discover',
      requiresAuth: false,
    },
  ]);

  /**
   * Expose auth service signals to template
   */
  readonly user = this.authService.user;
  readonly isAuthenticated = this.authService.isAuthenticated;

  /**
   * Expose theme service signals to template
   */
  readonly isDarkMode = this.themeService.isDarkMode;

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
   * Handles navigation and drawer behavior
   */
  onNavigationClick(item: NavItem): void {
    // Check if user is authenticated and item requires auth
    if (item.requiresAuth && !this.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.router.navigate([item.path]);

    // Close drawer on mobile after navigation
    if (this.isMobileViewSignal()) {
      this.drawer()?.close();
    }
  }

  /**
   * Toggles the drawer (mobile behavior)
   */
  toggleDrawer(): void {
    this.drawer()?.toggle();
  }

  /**
   * Toggles dark mode
   */
  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  /**
   * Handles sidebar hover enter (desktop only)
   */
  onSidebarHoverEnter(): void {
    if (!this.isMobileViewSignal()) {
      this.isSidebarHovered.set(true);
    }
  }

  /**
   * Handles sidebar hover leave (desktop only)
   */
  onSidebarHoverLeave(): void {
    if (!this.isMobileViewSignal()) {
      this.isSidebarHovered.set(false);
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

    // Transition from mobile to desktop: reset hover state
    if (wasMobile && !isMobileNow) {
      this.isSidebarHovered.set(false);
      this.drawer()?.close();
    }
    // Transition from desktop to mobile: close sidebar
    if (!wasMobile && isMobileNow) {
      this.isSidebarHovered.set(false);
      this.drawer()?.close();
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
  isRouteActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  /**
   * Check if nav item is disabled
   */
  isNavItemDisabled(item: NavItem): boolean {
    return item.requiresAuth && !this.isAuthenticated();
  }
}
