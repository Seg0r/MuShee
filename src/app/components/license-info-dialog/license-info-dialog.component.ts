import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-license-info-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions],
  templateUrl: './license-info-dialog.component.html',
  styleUrl: './license-info-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseInfoDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LicenseInfoDialogComponent>);

  onClose(): void {
    this.dialogRef.close();
  }
}
