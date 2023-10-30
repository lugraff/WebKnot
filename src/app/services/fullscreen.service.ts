import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { ResizeObservableService } from './resize-observable.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Vector2 } from './vector2.service';
import { distinctUntilChanged } from 'rxjs';

interface FullscreenDocument extends Document {
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  msExitFullscreen?: () => void;
  mozCancelFullScreen?: () => void;
}

interface FullscreenElement extends HTMLElement {
  msRequestFullscreen?: () => void;
  mozRequestFullScreen?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class FullscreenService {
  private resize = inject(ResizeObservableService);
  private destroy = inject(DestroyRef);

  public isFullScreenS = signal(false);
  private lastSize: Vector2 = { x: innerWidth, y: innerHeight };

  constructor() {
    document.addEventListener('keydown', (event) => {
      if (event.key == 'F11') {
        event.preventDefault();
      }
    });
    setTimeout(() => {
      const canvas = document.getElementById('canvas');
      if (canvas) {
        this.resize
          .resizeObservable(canvas)
          .pipe(takeUntilDestroyed(this.destroy))
          .pipe(distinctUntilChanged())
          .subscribe((canvas) => {
            if (this.lastSize.x > canvas.contentRect.width || this.lastSize.y > canvas.contentRect.height) {
              this.setFullScreen(false);
            }
            this.lastSize = { x: canvas.contentRect.width, y: canvas.contentRect.height };
          });
      }
    }, 500);
  }

  public setFullScreen(full: boolean): void {
    const fsDoc = <FullscreenDocument>document;
    if (full) {
      const fsDocElem = <FullscreenElement>document.documentElement;
      if (fsDocElem.requestFullscreen) {
        fsDocElem.requestFullscreen();
      } else if (fsDocElem.msRequestFullscreen) {
        fsDocElem.msRequestFullscreen();
      } else if (fsDocElem.mozRequestFullScreen) {
        fsDocElem.mozRequestFullScreen();
      }
      this.isFullScreenS.set(true);
      return;
    }
    setTimeout(() => {
      this.isFullScreenS.set(false);
    });
  }

  public toggleFullScreen(): void {
    const fsDoc = <FullscreenDocument>document;
    if (!this.isFullScreenS()) {
      const fsDocElem = <FullscreenElement>document.documentElement;
      if (fsDocElem.requestFullscreen) {
        fsDocElem.requestFullscreen();
      } else if (fsDocElem.msRequestFullscreen) {
        fsDocElem.msRequestFullscreen();
      } else if (fsDocElem.mozRequestFullScreen) {
        fsDocElem.mozRequestFullScreen();
      }
      this.isFullScreenS.set(true);
      return;
    } else if (fsDoc.exitFullscreen) {
      fsDoc.exitFullscreen();
    } else if (fsDoc.msExitFullscreen) {
      fsDoc.msExitFullscreen();
    } else if (fsDoc.mozCancelFullScreen) {
      fsDoc.mozCancelFullScreen();
    }
    this.isFullScreenS.set(false);
  }
}
