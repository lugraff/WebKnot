import { importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter } from '@angular/router';
import { GameComponent } from './app/components/game/game.component';
import { LimitNumber } from './app/pipes/limit.pipe';

export const ROUTES: Routes = [
  {
    path: '',
    component: GameComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];

bootstrapApplication(AppComponent, {
  providers: [LimitNumber, provideRouter(ROUTES), importProvidersFrom(BrowserModule)],
}).catch((err) => console.error(err));
