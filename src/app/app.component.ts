import { ChangeDetectionStrategy, Component, RendererFactory2, inject } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="overscroll-y-none custom-scrollbar w-[100dvw] h-[100dvh] bg-black text-subtle">
      <router-outlet></router-outlet>
    </div>
  `,
})
export class AppComponent {
  private _renderer = inject(RendererFactory2).createRenderer(null, null);
  private _document = inject(DOCUMENT);
  constructor() {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
      });
    }
    if (Capacitor.isNativePlatform()) {
      const element = this._document.getElementById('footerPanel');
      let footerColor = '#ffffff';
      if (element) {
        footerColor = getComputedStyle(element).backgroundColor;
      }
      NavigationBar.setColor({ color: '#00000000', darkButtons: false });
      StatusBar.setStyle({ style: Style.Dark });
      StatusBar.setBackgroundColor({ color: '#00000000' });
    }
  }
}
