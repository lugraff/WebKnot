import { Inject, Injectable, Optional, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { animationFrameScheduler, distinctUntilChanged, throttleTime } from 'rxjs';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';

export const INJECTION_TOKEN_SMALL_SCREEN_BREAKPOINT = 'SmallScreenBreakpoint';

@Injectable({
  providedIn: 'root',
})
export class ScreenService {
  private readonly throttleTime = 30;
  private _breakPoint = 768;
  private windowWidth = new BehaviorSubject<number>(innerWidth);
  private windowHeight = new BehaviorSubject<number>(innerHeight);

  public isSmallScreenS = signal(false);
  public isLandscapeS = signal(false);
  public sampledWindowWidthS = toSignal(
    this.windowWidth
      .pipe(throttleTime(this.throttleTime, animationFrameScheduler, { trailing: true }))
      .pipe(distinctUntilChanged())
      .pipe(takeUntilDestroyed()),
    { initialValue: innerWidth },
  );
  public sampledWindowHeightS = toSignal(
    this.windowHeight
      .pipe(throttleTime(this.throttleTime, animationFrameScheduler, { trailing: true }))
      .pipe(distinctUntilChanged())
      .pipe(takeUntilDestroyed()),
    { initialValue: innerHeight },
  );

  constructor(@Optional() @Inject(INJECTION_TOKEN_SMALL_SCREEN_BREAKPOINT) breakpoint: string) {
    this._breakPoint = this.convertBreakpoint(breakpoint ?? 'sm');
    this.isSmallScreenS.set(innerWidth < this._breakPoint);
    this.isLandscapeS.set(window.matchMedia('(orientation: landscape)').matches);
    window.addEventListener('resize', ($event: UIEvent) => {
      this.onResize($event);
    });
  }

  private onResize($event: UIEvent): void {
    const screen = $event.currentTarget as Window;
    this.windowHeight.next(screen.innerHeight);
    this.windowWidth.next(screen.innerWidth);
    this.isSmallScreenS.set(screen.innerWidth < this._breakPoint);
    this.isLandscapeS.set(window.matchMedia('(orientation: landscape)').matches);
  }

  private convertBreakpoint(breakpoint: string): number {
    if (typeof breakpoint !== 'string') {
      return 768;
    }
    if (breakpoint === 'sm') {
      return 640;
    } else if (breakpoint === 'md') {
      return 768;
    } else if (breakpoint === 'lg') {
      return 1024;
    } else if (breakpoint === 'xl') {
      return 1280;
    } else if (breakpoint === '2xl') {
      return 1536;
    } else if (breakpoint.endsWith('px')) {
      return parseInt(breakpoint.slice(0, -2).trim(), 10);
    }
    return this._breakPoint;
  }
}
