import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';

export type AiMode = 'off' | 'always' | 'scheduled';

export interface AiSettings {
  aiMode: AiMode;
  timezone: string;
}

export interface AiSchedule {
  weekday: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface ScheduleCollection {
  schedules: AiSchedule[];
}

@Injectable({ providedIn: 'root' })
export class BusinessAiSettingsService {
  private readonly http = inject(HttpClient);
  private readonly settingsUrl = '/api/business/settings';
  private readonly schedulesUrl = '/api/business/ai-schedules';

  load() {
    return forkJoin({
      settings: this.http.get<AiSettings>(this.settingsUrl),
      collection: this.http.get<ScheduleCollection>(this.schedulesUrl),
    });
  }

  saveSettings(settings: AiSettings) {
    return this.http.put<AiSettings>(this.settingsUrl, settings);
  }

  saveSchedules(schedules: AiSchedule[]) {
    return this.http.put<ScheduleCollection>(this.schedulesUrl, { schedules });
  }
}
