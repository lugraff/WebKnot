import { ComponentStore } from '@ngrx/component-store';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Vector2, Vector2Service } from '../services/vector2.service';
import { BehaviorSubject } from 'rxjs';
import { FpsMeterService } from '../services/fps-meter.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PointerEventService } from '../services/pointer-event.service';

interface Knot {
  id: string;
  pos: Vector2;
  dir: Vector2;
  speed: number;
  radius: number;
  size: number;
}

interface StoreModel {
  knots: Knot[];
  connectDist: number;
  minSpeed: number;
  maxSpeed: number;
  damping: number;
  lineWidth: number;
  isPressing: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class WebKnotStore extends ComponentStore<StoreModel> {
  private vector2 = inject(Vector2Service);
  public fpsMeter = inject(FpsMeterService);
  private ngZone = inject(NgZone);
  private destroy = inject(DestroyRef);
  private pointer = inject(PointerEventService);

  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  public processing = new BehaviorSubject<boolean>(true);

  private pointerPos: Vector2 = { x: 0, y: 0 };
  public range = 100;
  public power = 30;

  constructor() {
    super({ knots: [], connectDist: 130, minSpeed: 0.3, maxSpeed: 3, damping: 0.001, lineWidth: 6, isPressing: false });
    this.pointer.pointerPosition.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.pointerPos = { x: event.position.x, y: event.position.y };
      if (event.pressed !== undefined) {
        this.setIsPressing(event.pressed);
      }
    });
    // event.index
  }

  public initCanvas(): void {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
      this.ctx.lineCap = 'round';
      this.ctx.lineWidth = this.widthS();
    }
    this.processing
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.ngZone.runOutsideAngular(() => this.process(0)));
  }

  private process(timestamp: number): void {
    if (!this.processing.value || !this.canvas) {
      return;
    }
    // this.fpsMeter.calcFPS(timestamp);
    this.calcNextFrame();
    requestAnimationFrame((timestamp) => this.process(timestamp));
  }

  private knotsS = this.selectSignal((state) => state.knots);
  private minSpeedS = this.selectSignal((state) => state.minSpeed);
  private connectDistS = this.selectSignal((state) => state.connectDist);
  private isPressingS = this.selectSignal((state) => state.isPressing);
  private minS = this.selectSignal((state) => state.minSpeed);
  private maxS = this.selectSignal((state) => state.maxSpeed);
  private dampingS = this.selectSignal((state) => state.damping);
  private widthS = this.selectSignal((state) => state.lineWidth);

  private setIsPressing = this.updater((state, isPressing: boolean): StoreModel => {
    return { ...state, isPressing };
  });

  public createKnots = this.updater((state, amount: number): StoreModel => {
    const newKnots: Knot[] = [];
    for (let index = 0; index < amount; index++) {
      const newKnot: Knot = {
        id: index.toString(), //Math.floor(index * Math.random() * 10000000).toString(),
        pos: { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight },
        dir: this.vector2.normalize({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        }),
        speed: Math.random() + index * 0.05 * this.minSpeedS(),
        radius: 9,
        size: 6,
      };
      newKnots.push(newKnot);
    }
    return { ...state, knots: [...state.knots, ...newKnots] };
  });

  public removeKnot = this.updater((state, index: number): StoreModel => {
    const newKnots: Knot[] = [...state.knots];
    newKnots.splice(index, 1);

    return { ...state, knots: newKnots };
  });

  private calcNextFrame(): void {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let index = 0; index < this.knotsS().length; index++) {
        if (this.isPressingS()) {
          if (this.calcActions(this.knotsS()[index], index)) {
            continue;
          }
        }
        this.calcBehavior(this.knotsS()[index]);
        this.calcNextPos(this.knotsS()[index]);
        this.calcBorders(this.knotsS()[index]);
        this.paintLine(this.ctx, index);
        this.paintBall(this.ctx, this.knotsS()[index]);
      }
      this.setIsPressing(false);
    }
  }

  private calcActions(ball: Knot, index: number): boolean {
    const distance = this.vector2.distance(ball.pos, this.pointerPos);
    if (distance < this.range) {
      if (distance < ball.radius) {
        this.removeKnot(index);
        return true;
      }
      // const dash = this.vec2Service.sub(ball.pos, this.pointerPos);
      // ball.pos.x += dash.x * 0.1;
      // ball.pos.y += dash.y * 0.1;
      ball.dir = this.vector2.normalize(this.vector2.sub(ball.pos, this.pointerPos));
      ball.speed = (this.power / distance) * 10;
    }
    return false;
  }

  private calcBehavior(ball: Knot): void {
    if (ball.speed < this.minS()) {
      ball.speed = this.minS();
    } else {
      ball.speed -= this.dampingS();
    }
    if (ball.speed > this.maxS()) {
      ball.speed = this.maxS();
    }
  }

  private calcNextPos(ball: Knot): void {
    ball.pos.x += ball.dir.x * ball.speed;
    ball.pos.y += ball.dir.y * ball.speed;
  }

  private calcBorders(ball: Knot): void {
    if (ball.pos.y < ball.radius) {
      ball.pos.y = ball.radius;
      ball.dir.y = -ball.dir.y;
    } else if (ball.pos.y + ball.radius > window.innerHeight) {
      ball.pos.y = window.innerHeight - ball.radius;
      ball.dir.y = -ball.dir.y;
    }
    if (ball.pos.x < ball.radius) {
      ball.pos.x = ball.radius;
      ball.dir.x = -ball.dir.x;
    } else if (ball.pos.x + ball.radius > window.innerWidth) {
      ball.pos.x = window.innerWidth - ball.radius;
      ball.dir.x = -ball.dir.x;
    }
  }

  private paintBall(ctx: CanvasRenderingContext2D, ball: Knot): void {
    ctx.fillStyle = '#ffffff99';
    const circle = new Path2D();
    circle.arc(ball.pos.x, ball.pos.y, ball.radius, 0, 2 * Math.PI);
    ctx.fill(circle);
  }

  private paintLine(ctx: CanvasRenderingContext2D, ballIndex: number): void {
    const posSelf: Vector2 = this.knotsS()[ballIndex].pos;
    for (let index = ballIndex; index < this.knotsS().length; index++) {
      const posOther: Vector2 = this.knotsS()[index].pos;
      const distance = Math.sqrt(
        (posSelf.x - posOther.x) * (posSelf.x - posOther.x) + (posSelf.y - posOther.y) * (posSelf.y - posOther.y),
      );
      if (distance < this.connectDistS()) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(
            ${distance * 4},
            ${distance * 4},
            ${distance * 4},
            ${(this.connectDistS() - distance) / this.connectDistS()})`;
        this.net(ctx, posSelf, index);
        // ctx.fill();
        ctx.stroke();
        // ctx.save();
        // ctx.scale(-1, 1);
        // ctx.restore();
        // ctx.stroke();
      }
    }
  }

  private net(ctx: CanvasRenderingContext2D, posSelf: Vector2, index: number): void {
    ctx.moveTo(posSelf.x, posSelf.y);
    ctx.lineTo(this.knotsS()[index].pos.x, this.knotsS()[index].pos.y);
  }
}
