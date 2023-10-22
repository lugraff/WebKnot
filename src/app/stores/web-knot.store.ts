import { ComponentStore } from '@ngrx/component-store';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Vector2, Vector2Service } from '../services/vector2.service';
import { BehaviorSubject } from 'rxjs';
import { FpsMeterService } from '../services/fps-meter.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface Knot {
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

  private canvas: HTMLCanvasElement | undefined = undefined;
  public processing = new BehaviorSubject<boolean>(true);

  private pointerPos: Vector2 = { x: 0, y: 0 }; //TODO weg!
  public range = 800;
  public power = 30;

  constructor() {
    super({ knots: [], connectDist: 150, minSpeed: 1, maxSpeed: 3, damping: 0.1, lineWidth: 6, isPressing: false });
  }
  public initCanvas(): void {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (this.canvas) {
      console.log(this.canvas);
    }
    this.processing
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.ngZone.runOutsideAngular(() => this.process(0)));
  }

  private process(timestamp: number): void {
    if (!this.processing.value || !this.canvas) {
      return;
    }
    this.fpsMeter.calcFPS(timestamp);

    const ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.lineCap = 'round';
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let index = 0; index < this.knotsS().length; index++) {
      this.calcBehavior(this.knotsS()[index]);
      this.calcDotPos(this.knotsS()[index]);
      this.paintBall(ctx, this.knotsS()[index]);
      this.paintLine(ctx, index);
    }

    // ctx.strokeStyle = '#ffffffff';
    // ctx.fillStyle = '#00ff00aa';
    // ctx.lineJoin = 'round';
    console.log('A');
    requestAnimationFrame((timestamp) => this.process(timestamp));
  }

  private knotsS = this.selectSignal((state) => state.knots);
  private minSpeedS = this.selectSignal((state) => state.minSpeed);
  private connectDistS = this.selectSignal((state) => state.connectDist);
  private isPressingS = this.selectSignal((state) => state.isPressing);
  private minS = this.selectSignal((state) => state.minSpeed);
  private maxS = this.selectSignal((state) => state.maxSpeed);
  private dampingS = this.selectSignal((state) => state.damping);

  public createKnots = this.updater((state, amount: number): StoreModel => {
    const newKnots: Knot[] = [];
    for (let index = 0; index < amount; index++) {
      const newKnot: Knot = {
        pos: { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight },
        dir: this.vector2.normalize({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        }),
        speed: Math.random() * this.minSpeedS(),
        radius: 9,
        size: 6,
      };
      newKnots.push(newKnot);
    }
    return { ...state, knots: [...state.knots, ...newKnots] };
  });

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

  private calcBehavior(ball: Knot): void {
    let pushing = false;
    if (this.isPressingS()) {
      const distance = this.vector2.distance(ball.pos, this.pointerPos);
      if (distance < this.range) {
        // const dash = this.vec2Service.sub(ball.pos, this.pointerPos);
        // ball.pos.x += dash.x * 0.1;
        // ball.pos.y += dash.y * 0.1;
        ball.dir = this.vector2.normalize(this.vector2.sub(ball.pos, this.pointerPos));
        ball.speed = (this.power / distance) * 10;
        if (ball.speed > this.maxS()) {
          ball.speed = this.maxS();
        }
        pushing = true;
      }
    }
    if (!pushing) {
      if (ball.speed > this.minS()) {
        ball.speed -= this.dampingS();
      } else {
        ball.speed = this.minS();
      }
    }
  }

  private calcDotPos(ball: Knot): void {
    ball.pos.x += ball.dir.x * ball.speed;
    ball.pos.y += ball.dir.y * ball.speed;
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

  // public filteredCategoriesS = computed((): Category[] => {
  //   return this.categoriesS().filter((category) => category.isMain !== this.showDetailsCategoriesS());
  // });
}
