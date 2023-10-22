import { Injectable, signal } from '@angular/core';

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
  public isFullScreen = signal(false);

  // Info Wenn der Benutzer schon mit Fullscreen startet, kann man diesen glaub ich nicht programmtechnisch verlassen...
  // constructor() {
  //   this.isFullScreen.set(!(!window.screenTop && !window.screenY));
  // }

  public setFullScreen(full: boolean): void {
    if (full !== this.isFullScreen()) this.toggleFullScreen();
  }

  public toggleFullScreen(): void {
    const fsDoc = <FullscreenDocument>document;
    if (!this.isFullScreen()) {
      const fsDocElem = <FullscreenElement>document.documentElement;
      if (fsDocElem.requestFullscreen) {
        fsDocElem.requestFullscreen();
      } else if (fsDocElem.msRequestFullscreen) {
        fsDocElem.msRequestFullscreen();
      } else if (fsDocElem.mozRequestFullScreen) {
        fsDocElem.mozRequestFullScreen();
      }
      this.isFullScreen.set(true);
      return;
    } else if (fsDoc.exitFullscreen) {
      fsDoc.exitFullscreen();
    } else if (fsDoc.msExitFullscreen) {
      fsDoc.msExitFullscreen();
    } else if (fsDoc.mozCancelFullScreen) {
      fsDoc.mozCancelFullScreen();
    }
    this.isFullScreen.set(false);
  }
}
