import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Workspace } from './workspaces';

@Component({
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatInputModule, RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly routeData = inject(ActivatedRoute).snapshot.data;
  protected readonly workspace: Workspace = this.routeData['workspace'];
  protected readonly otherWorkspace: Workspace = this.routeData['otherWorkspace'];
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    password: [{ value: '', disabled: true }, Validators.required],
  });
}
