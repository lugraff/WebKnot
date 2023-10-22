import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FpsMeterService {
  private fpsS = signal(0);
  private fpsStack: number[] = [];
  private lastDelta = 0;

  public calcFPS(delta: number): void {
    this.fpsStack.push(delta - this.lastDelta);
    this.lastDelta = delta;
    this.fpsS.set(Math.round((1 / (this.fpsStack.reduce((a, b) => a + b, 0) / this.fpsStack.length)) * 1000));
    if (this.fpsStack.length > 60) {
      this.fpsStack.splice(0, 1);
    }
  }

  public fpsC = computed(() => {
    return this.fpsS();
  });
}
