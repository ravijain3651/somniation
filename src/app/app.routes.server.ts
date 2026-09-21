import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Auth-dependent pages render in the browser only.
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'timesheet', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
