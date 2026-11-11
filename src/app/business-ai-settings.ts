import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize, Observable } from 'rxjs';

import { AiMode, AiSchedule, BusinessAiSettingsService } from './business-ai-settings.service';

import { DeliverySettingsSection } from './delivery-settings';

const defaultTimezone = 'Asia/Dhaka';
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

type IntervalForm = FormGroup<{
  startTime: FormControl<string>;
  endTime: FormControl<string>;
  isActive: FormControl<boolean>;
}>;

type SaveArea = 'settings' | 'schedules';
type SaveFeedback = { kind: 'success' | 'error'; message: string };

function normalizedTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

function errorDetail(error: unknown): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
    return ` ${error.error.error}`;
  }
  return '';
}

@Component({
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatProgressBarModule, MatRadioModule, MatSlideToggleModule, DeliverySettingsSection,
  ],
  templateUrl: './business-ai-settings.html',
  styleUrl: './business-ai-settings.scss',
})
export class BusinessAiSettingsPage {
  private readonly api = inject(BusinessAiSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly forms = inject(FormBuilder).nonNullable;

  protected readonly modes: readonly AiMode[] = ['off', 'always', 'scheduled'];
  protected readonly settings = this.forms.group({
    aiMode: this.forms.control<AiMode>('off', Validators.required),
    timezone: this.forms.control(defaultTimezone, Validators.required),
  });
  protected readonly mode = toSignal(this.settings.controls.aiMode.valueChanges, { initialValue: 'off' });
  protected readonly zones = signal(this.timezones(defaultTimezone));
  protected readonly days = weekdays.map((label) => ({
    label,
    intervals: this.forms.array<IntervalForm>([]),
  }));
  protected readonly scheduleForm = this.forms.group({
    days: this.forms.array(this.days.map((day) => day.intervals)),
  });
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly saving = signal<SaveArea | null>(null);
  protected readonly settingsFeedback = signal<SaveFeedback | null>(null);
  protected readonly scheduleFeedback = signal<SaveFeedback | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.loadError.set('');
    this.api.load().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ settings, collection }) => {
        this.zones.set(this.timezones(settings.timezone));
        this.settings.reset(settings);
        this.setSchedules(collection.schedules);
      },
      error: (error: unknown) => {
        this.loadError.set(`Unable to load AI settings and schedules.${errorDetail(error)}`);
      },
    });
  }

  protected addInterval(weekday: number): void {
    this.days[weekday].intervals.push(this.createInterval());
  }

  protected removeInterval(weekday: number, index: number): void {
    this.days[weekday].intervals.removeAt(index);
  }

  protected endsNextDay(interval: IntervalForm): boolean {
    const { startTime, endTime } = interval.controls;
    return startTime.valid && endTime.valid
      && normalizedTime(startTime.value) > normalizedTime(endTime.value);
  }

  protected saveSettings(): void {
    if (this.saving()) return;
    this.settings.markAllAsTouched();
    if (this.settings.invalid) return;

    this.save('settings', this.api.saveSettings(this.settings.getRawValue()),
      (settings) => this.settings.reset(settings));
  }

  protected saveSchedules(): void {
    if (this.saving() || this.mode() !== 'scheduled') return;
    this.scheduleForm.markAllAsTouched();
    if (this.scheduleForm.invalid) return;

    const schedules = this.days.flatMap(({ intervals }, weekday) =>
      intervals.getRawValue().map((interval) => ({ weekday, ...interval })),
    );
    this.save('schedules', this.api.saveSchedules(schedules),
      ({ schedules: saved }) => this.setSchedules(saved));
  }

  private save<T>(area: SaveArea, request: Observable<T>, apply: (value: T) => void): void {
    const isSettings = area === 'settings';
    const feedback = isSettings ? this.settingsFeedback : this.scheduleFeedback;
    this.saving.set(area);
    feedback.set(null);
    this.settings.disable({ emitEvent: false });
    this.scheduleForm.disable({ emitEvent: false });

    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.settings.enable({ emitEvent: false });
        this.scheduleForm.enable({ emitEvent: false });
        this.saving.set(null);
      }),
    ).subscribe({
      next: (value) => {
        apply(value);
        feedback.set({ kind: 'success', message: isSettings ? 'AI settings saved.' : 'Weekly schedule saved.' });
      },
      error: (error: unknown) => {
        const message = isSettings
          ? 'Could not confirm that AI mode and timezone were saved.'
          : 'Could not confirm that the weekly schedule was saved. Your edits are still here.';
        feedback.set({ kind: 'error', message: message + errorDetail(error) });
      },
    });
  }

  private setSchedules(schedules: AiSchedule[]): void {
    for (const [weekday, { intervals }] of this.days.entries()) {
      const saved = schedules.filter((schedule) => schedule.weekday === weekday);
      while (intervals.length > saved.length) intervals.removeAt(intervals.length - 1);

      for (const [index, { startTime, endTime, isActive }] of saved.entries()) {
        const interval = { startTime, endTime, isActive };
        if (index < intervals.length) {
          intervals.at(index).reset(interval);
        } else {
          intervals.push(this.createInterval(interval));
        }
      }
    }
  }

  private createInterval(interval?: Omit<AiSchedule, 'weekday'>): IntervalForm {
    const timeValidators = [Validators.required, Validators.pattern(timePattern)];
    const form = this.forms.group({
      startTime: [interval?.startTime ?? '', timeValidators],
      endTime: [interval?.endTime ?? '', timeValidators],
      isActive: interval?.isActive ?? true,
    });
    form.addValidators(() => {
      const { startTime, endTime } = form.getRawValue();
      return startTime && endTime && normalizedTime(startTime) === normalizedTime(endTime)
        ? { sameTime: true }
        : null;
    });
    return form;
  }

  private timezones(current: string): string[] {
    return [...new Set([defaultTimezone, 'UTC', current, ...Intl.supportedValuesOf('timeZone')])]
      .sort((a, b) => a.localeCompare(b));
  }
}
