import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface DeliverySettingsInput {
  insideDhakaFee: string;
  outsideDhakaFee: string;
  insideDhakaDeliveryDays: string | null;
  outsideDhakaDeliveryDays: string | null;
}

export interface DeliverySettings extends DeliverySettingsInput {
  currency: string;
}

@Injectable({ providedIn: 'root' })
export class DeliverySettingsService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/business/delivery-settings';

  load() {
    return this.http.get<DeliverySettings>(this.url);
  }

  save(settings: DeliverySettingsInput) {
    return this.http.put<DeliverySettings>(this.url, settings);
  }
}
