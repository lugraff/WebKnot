import { PointerEventService } from 'src/app/services/pointer-event.service';
import { Vector2, Vector2Service } from 'src/app/services/vector2.service';
import { ScreenService } from 'src/app/services/screen.service';
import { BehaviorSubject, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MachineInfoService } from 'src/app/services/machine-info.service';
import { FullscreenService } from 'src/app/services/fullscreen.service';
import { FpsMeterService } from 'src/app/services/fps-meter.service';
import { WebKnotStore } from 'src/app/stores/web-knot.store';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  NgZone,
  effect,
  inject,
} from '@angular/core';

interface Dot {
  pos: Vector2;
  dir: Vector2;
  speed: number;
  radius: number;
}

@Component({
  selector: 'lucreativ-net-animation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './net-animation.component.html',
})
export class NetAnimationComponent implements AfterViewInit {
  private machine = inject(MachineInfoService);
  private fullscreen = inject(FullscreenService);
  private detector = inject(ChangeDetectorRef);
  public screen = inject(ScreenService);
  public fpsMeter = inject(FpsMeterService);
  public store = inject(WebKnotStore);

  @HostListener('window:keydown', ['$event']) onKey(event: KeyboardEvent) {
    if (event.code === 'Space') {
      this.onTogglePlaying();
    }
  }
  @HostListener('contextmenu', ['$event'])
  onRightClick(event: MouseEvent) {
    event.preventDefault();
  }

  constructor() {
    effect(() => {
      this.fpsMeter.fpsC();
      this.detector.detectChanges();
    });
  }

  public ngAfterViewInit(): void {
    if (this.machine.isTouch) {
      this.fullscreen.setFullScreen(true);
    }
    this.store.initCanvas();
    this.store.createKnots(60);
  }

  public onTogglePlaying(): void {
    this.store.processing.next(!this.store.processing.value);
  }
}
