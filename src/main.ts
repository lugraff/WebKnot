import { importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter } from '@angular/router';
import { NetAnimationComponent } from './app/components/net-animation/net-animation.component';

export const ROUTES: Routes = [
  {
    path: '',
    component: NetAnimationComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];

bootstrapApplication(AppComponent, {
  providers: [provideRouter(ROUTES), importProvidersFrom(BrowserModule)],
}).catch((err) => console.error(err));
