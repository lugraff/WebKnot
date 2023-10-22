// von https://github.com/AnthonyNahas/ngx-long-press2/blob/master/projects/ngx-long-press2/src/lib/ngx-long-press2.directive.ts abgeleitet
/* eslint-disable @angular-eslint/directive-selector */
/* eslint-disable @angular-eslint/no-output-on-prefix */
import { Directive, ElementRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { MachineInfoService } from '../services/machine-info.service';

export interface LongPressEvent {
  event: MouseEvent | TouchEvent;
  time: number;
  isLongPress: boolean;
}

@Directive({
  selector: '[LongPress]',
  standalone: true,
})
export class LongPressDirective {
  private elRef = inject(ElementRef);
  private machine = inject(MachineInfoService);

  private pressing = false;
  private pressingLong = false;
  private timeout: any;
  private interval: any;
  private lapsedTime = 0;
  private readonly sampleTime = 50;

  @Input() minTime = 150;
  @Input() maxTime = 3500;
  @Output() onLongDownStart: EventEmitter<LongPressEvent> = new EventEmitter();
  @Output() onLongDown: EventEmitter<LongPressEvent> = new EventEmitter();
  @Output() onHoldingDown: EventEmitter<LongPressEvent> = new EventEmitter();
  @Output() onLongUp: EventEmitter<LongPressEvent> = new EventEmitter();

  private mouseDownEventRef: (ev: MouseEvent) => unknown = (event: MouseEvent) => this.onDown(event);
  private touchStartEventRef: (ev: TouchEvent) => unknown = (event: TouchEvent) => this.onDown(event);
  private mouseUpEventRef: (ev: MouseEvent) => unknown = (event: MouseEvent) => this.onUp(event);
  private touchEndEventRef: (ev: TouchEvent) => unknown = (event: TouchEvent) => this.onUp(event);
  private mouseLeaveEventRef: () => unknown = () => this.onCancel();

  constructor() {
    if (this.machine.isTouch) {
      this.elRef.nativeElement.addEventListener('touchstart', this.touchStartEventRef);
      this.elRef.nativeElement.addEventListener('touchend', this.touchEndEventRef);
    } else {
      this.elRef.nativeElement.addEventListener('mousedown', this.mouseDownEventRef);
      this.elRef.nativeElement.addEventListener('mouseup', this.mouseUpEventRef);
      this.elRef.nativeElement.addEventListener('mouseleave', this.mouseLeaveEventRef);
    }
  }

  private onDown(event: MouseEvent | TouchEvent): void {
    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    } else if (event instanceof TouchEvent && event.touches.length > 1) {
      return;
    }
    this.pressing = true;
    this.onLongDownStart.emit({ event: event, time: this.lapsedTime, isLongPress: this.pressingLong });
    this.timeout = setTimeout(() => {
      this.interval = setInterval(() => {
        if (this.lapsedTime >= this.minTime && !this.pressingLong) {
          this.pressingLong = true;
          this.onLongDown.emit({ event: event, time: this.lapsedTime, isLongPress: this.pressingLong });
        }
        this.onHoldingDown.emit({ event: event, time: this.lapsedTime, isLongPress: this.pressingLong });
        if (this.lapsedTime < this.maxTime) {
          this.lapsedTime += this.sampleTime;
        } else {
          this.finish();
        }
      }, this.sampleTime);
    }, this.minTime);
  }

  private onUp(event: MouseEvent | TouchEvent): void {
    if (this.pressing) {
      this.onLongUp.next({ event: event, time: this.lapsedTime, isLongPress: this.pressingLong });
      this.finish();
    }
  }

  private onCancel(): void {
    if (this.pressing) {
      this.finish();
    }
  }

  private finish(): void {
    clearTimeout(this.timeout);
    clearInterval(this.interval);
    this.pressing = false;
    this.pressingLong = false;
    this.lapsedTime = 0;
  }
}
