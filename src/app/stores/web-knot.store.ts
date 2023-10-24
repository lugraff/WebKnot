import { ComponentStore } from '@ngrx/component-store';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Vector2, Vector2Service } from '../services/vector2.service';
import { BehaviorSubject } from 'rxjs';
import { FpsMeterService } from '../services/fps-meter.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PointerEventService } from '../services/pointer-event.service';

interface Particle {
  pos: Vector2;
  dir: Vector2;
  speed: number;
  radius: number;
  lifetime: number;
}
interface Lines {
  target: Vector2;
  distance: number;
}
interface Knot {
  id: string;
  pos: Vector2;
  dir: Vector2;
  speed: number;
  radius: number;
  lines: Lines[];
}

interface StoreModel {
  knots: Knot[];
  particles: Particle[];
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
  public range = 120;
  public power = 30;
  public radius = 32;

  constructor() {
    super({
      knots: [],
      particles: [],
      connectDist: 160,
      minSpeed: 0.3,
      maxSpeed: 3,
      damping: 0.005,
      lineWidth: 5,
      isPressing: false,
    });
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
  private particlesS = this.selectSignal((state) => state.particles);
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
        radius: 0,
        lines: [],
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
      this.calcNextParticle();
      for (let index = 0; index < this.knotsS().length; index++) {
        if (this.isPressingS()) {
          if (this.calcActions(this.knotsS()[index], index)) {
            continue;
          }
        }
        this.calcBehavior(this.knotsS()[index]);
        this.calcNextPos(this.knotsS()[index]);
        this.calcBorders(this.knotsS()[index]);
        this.calcConnections(index);
        this.paintLine(this.ctx, this.knotsS()[index]);
        this.paintBall(this.ctx, this.knotsS()[index]);
      }
      this.setIsPressing(false);
    }
  }

  private calcActions(ball: Knot, index: number): boolean {
    const distance = this.vector2.distance(ball.pos, this.pointerPos);
    if (distance < this.range) {
      console.log(ball.radius, this.radius - 16);
      if (distance < ball.radius && ball.radius >= this.radius - 16) {
        this.removeKnot(index);
        this.createParticles(ball.pos); //TODO sehen was passiert wenn da geclont wird...
        return true;
      }
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

  private calcConnections(ballIndex: number): void {
    const ball = this.knotsS()[ballIndex];
    const lines: Lines[] = [];
    let distanceTotal = 0;
    for (let index = ballIndex; index < this.knotsS().length; index++) {
      const target: Vector2 = this.knotsS()[index].pos;
      const distance = Math.sqrt(
        (ball.pos.x - target.x) * (ball.pos.x - target.x) + (ball.pos.y - target.y) * (ball.pos.y - target.y),
      );
      if (distance < this.connectDistS()) {
        lines.push({ target, distance });
        distanceTotal += this.connectDistS() - distance;
      }
    }
    let radius = Math.round(this.radius * 10 - distanceTotal) * 0.1;
    if (radius < this.widthS()) {
      radius = this.widthS();
    }
    ball.radius = radius;
    ball.lines = lines;
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
    ctx.fillStyle = '#aaaaaa';
    const circle = new Path2D();
    circle.arc(ball.pos.x, ball.pos.y, ball.radius, 0, 2 * Math.PI);
    ctx.fill(circle);
  }

  private paintLine(ctx: CanvasRenderingContext2D, ball: Knot): void {
    for (const line of ball.lines) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(
        ${line.distance * 4},
        ${line.distance * 4},
        ${line.distance * 4},
        ${(this.connectDistS() - line.distance) / this.connectDistS()})`;
      ctx.moveTo(ball.pos.x, ball.pos.y);
      ctx.lineTo(line.target.x, line.target.y);
      ctx.stroke();
    }
  }

  public createParticles = this.updater((state, position: Vector2): StoreModel => {
    const newParticles: Particle[] = [];
    for (let index = 0; index < 96; index++) {
      const newParticle: Particle = {
        pos: { x: position.x + (Math.random() - 0.5) * 12, y: position.y + (Math.random() - 0.5) * 12 },
        dir: this.vector2.normalize({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        }),
        speed: 3 + index * 0.001 + Math.random() * 3,
        radius: 3,
        lifetime: 60,
      };
      newParticles.push(newParticle);
    }
    return { ...state, particles: [...state.particles, ...newParticles] };
  });

  private calcNextParticle(): void {
    if (this.ctx) {
      let destroy = false;
      for (const particle of this.particlesS()) {
        particle.pos.x += particle.dir.x * particle.speed; // * (particle.lifetime * 10);
        particle.pos.y += particle.dir.y * particle.speed; // * (particle.lifetime * 10);
        particle.radius -= 0.03;
        particle.lifetime -= 1;
        if (particle.lifetime < 0) {
          destroy = true;
        }
        this.paintParticle(this.ctx, particle);
      }
      if (destroy) {
        this.removeParticle(100);
      }
    }
  }

  private paintParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
    ctx.fillStyle = `rgba(256,256,256,${(1 / 60) * particle.lifetime})`;
    const circle = new Path2D();
    circle.arc(particle.pos.x, particle.pos.y, particle.radius, 0, 2 * Math.PI);
    ctx.fill(circle);
  }

  public removeParticle = this.updater((state, amount: number): StoreModel => {
    const newParticles: Particle[] = [...state.particles];
    newParticles.splice(0, amount);
    return { ...state, particles: newParticles };
  });
}
