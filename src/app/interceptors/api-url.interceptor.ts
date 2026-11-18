import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
    if (req.url.startsWith('/api/')) {
        req = req.clone({
            url: `${environment.apiBaseUrl}${req.url}`,
        });
    }

    return next(req);
};