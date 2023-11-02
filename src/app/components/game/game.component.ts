import { ScreenService } from 'src/app/services/screen.service';
import { MachineInfoService } from 'src/app/services/machine-info.service';
import { FullscreenService } from 'src/app/services/fullscreen.service';
import { FpsMeterService } from 'src/app/services/fps-meter.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  effect,
  inject,
} from '@angular/core';
import { WebKnotService } from 'src/app/services/web-knot.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'game',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './game.component.html',
})
export class GameComponent implements AfterViewInit {
  private machine = inject(MachineInfoService);
  private detector = inject(ChangeDetectorRef);
  public fullscreen = inject(FullscreenService);
  public screen = inject(ScreenService);
  public fpsMeter = inject(FpsMeterService);
  public store = inject(WebKnotService);

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
    this.store.createKnots(16);
  }

  public onTogglePlaying(): void {
    this.store.processing.next(!this.store.processing.value);
  }
}
