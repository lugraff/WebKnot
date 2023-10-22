import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
export class AppComponent {}
