import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  await auth.ready;
  if (auth.signedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  await auth.ready;
  if (!auth.signedIn()) {
    return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/timesheet']);
};
