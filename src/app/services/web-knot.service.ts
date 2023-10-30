import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Vector2, Vector2Service } from './vector2.service';
import { BehaviorSubject } from 'rxjs';
import { FpsMeterService } from './fps-meter.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PointerEventService } from './pointer-event.service';
import { LimitNumber } from '../pipes/limit.pipe';

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
  pos: Vector2;
  dir: Vector2;
  speed: number;
  radius: number;
  lines: Lines[];
  lineLength: number;
}

@Injectable({
  providedIn: 'root',
})
export class WebKnotService {
  private vector2 = inject(Vector2Service);
  public fpsMeter = inject(FpsMeterService);
  private ngZone = inject(NgZone);
  private destroy = inject(DestroyRef);
  private pointer = inject(PointerEventService);
  private limit = inject(LimitNumber);

  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  public processing = new BehaviorSubject<boolean>(true);

  private pointerPos: Vector2 = { x: 0, y: 0 };
  public range = 120;
  public power = 64;

  private knots: Knot[] = [];
  private particles: Particle[] = [];
  private connectDist = 140;
  private minSpeed = 0.3;
  private maxSpeed = 3;
  private damping = 0.005;
  private lineWidth = 1;
  private isPressing = false;

  constructor() {
    this.pointer.pointerPosition.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.pointerPos = { x: event.position.x, y: event.position.y };
      if (event.pressed !== undefined) {
        this.isPressing = event.pressed;
      }
    });
    // event.index
  }

  public initCanvas(): void {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
      this.ctx.lineCap = 'round';
      this.ctx.lineWidth = this.lineWidth;
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

  public createKnots(amount: number): void {
    const newKnots: Knot[] = [];
    for (let index = 0; index < amount; index++) {
      const newKnot: Knot = {
        pos: { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight },
        dir: this.vector2.normalize({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        }),
        speed: Math.random() + index * 0.05 * this.minSpeed,
        radius: 16,
        lines: [],
        lineLength: 0,
      };
      newKnots.push(newKnot);
    }
    this.knots = [...this.knots, ...newKnots];
  }

  public removeKnot(index: number): void {
    this.knots.splice(index, 1);
  }

  private calcNextFrame(): void {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.calcNextParticle();
      for (let index = 0; index < this.knots.length; index++) {
        if (this.isPressing) {
          if (this.calcActions(this.knots[index], index)) {
            continue;
          }
        }
        this.calcConnectionMagnetic(this.knots[index]);
        this.calcBehavior(this.knots[index]);
        this.calcNextPos(this.knots[index]);
        this.calcBorders(this.knots[index]);
        this.calcConnections(index);
        this.paintLine(this.ctx, this.knots[index]);
        this.paintKnot(this.ctx, this.knots[index]);
        this.paintProtection(this.ctx, this.knots[index]);
        // this.paintSquare(this.ctx, this.knots[index]);
      }
      this.isPressing = false;
    }
  }

  private calcActions(knot: Knot, index: number): boolean {
    const distance = this.vector2.distance(knot.pos, this.pointerPos);
    if (distance < this.range) {
      if (distance < knot.radius && knot.lines.length <= 0) {
        this.removeKnot(index);
        this.createParticles(knot.pos);
        return true;
      }
      knot.dir = this.vector2.normalize(this.vector2.sub(knot.pos, this.pointerPos));
      knot.speed = (this.power / distance) * 10;
    }
    return false;
  }

  private calcBehavior(knot: Knot): void {
    if (knot.speed < this.minSpeed) {
      knot.speed = this.minSpeed;
    } else {
      knot.speed -= this.damping;
    }
    if (knot.speed > this.maxSpeed) {
      knot.speed = this.maxSpeed;
    }
  }

  private calcNextPos(knot: Knot): void {
    knot.pos.x += knot.dir.x * knot.speed;
    knot.pos.y += knot.dir.y * knot.speed;
  }

  private calcConnections(knotIndex: number): void {
    const knot = this.knots[knotIndex];
    const lines: Lines[] = [];
    let distanceTotal = 0;
    for (let index = knotIndex; index < this.knots.length; index++) {
      if (knotIndex === index) {
        continue;
      }
      const target: Vector2 = this.knots[index].pos;
      const distance = this.vector2.distance(knot.pos, target);
      if (distance < this.connectDist) {
        lines.push({ target, distance });
        distanceTotal += this.connectDist - distance;
      }
    }
    knot.lineLength = distanceTotal;
    knot.lines = lines;
  }

  private calcConnectionMagnetic(knot: Knot): void {
    for (const line of knot.lines) {
      const magnetic = this.vector2.sub(knot.pos, line.target);
      knot.dir.x -= magnetic.x * 0.00007;
      knot.dir.y -= magnetic.y * 0.00007;
      knot.dir.x = this.limit.transform(knot.dir.x, -3, 3, false);
      knot.dir.y = this.limit.transform(knot.dir.y, -3, 3, false);
    }
  }

  private calcBorders(knot: Knot): void {
    if (knot.pos.y < knot.radius) {
      knot.pos.y = knot.radius;
      knot.dir.y = -knot.dir.y;
    } else if (knot.pos.y + knot.radius > window.innerHeight) {
      knot.pos.y = window.innerHeight - knot.radius;
      knot.dir.y = -knot.dir.y;
    }
    if (knot.pos.x < knot.radius) {
      knot.pos.x = knot.radius;
      knot.dir.x = -knot.dir.x;
    } else if (knot.pos.x + knot.radius > window.innerWidth) {
      knot.pos.x = window.innerWidth - knot.radius;
      knot.dir.x = -knot.dir.x;
    }
  }

  private paintKnot(ctx: CanvasRenderingContext2D, knot: Knot): void {
    var gradient = ctx.createRadialGradient(knot.pos.x, knot.pos.y, 0.5, knot.pos.x, knot.pos.y, knot.radius);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'transparent');
    const path2D = new Path2D();
    path2D.arc(knot.pos.x, knot.pos.y, knot.radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill(path2D);
  }

  private paintSquare(ctx: CanvasRenderingContext2D, knot: Knot): void {
    ctx.fillStyle = '#aaaaaa';
    const path2D = new Path2D();
    path2D.roundRect(knot.pos.x - knot.radius * 0.5, knot.pos.y - knot.radius * 0.5, knot.radius, knot.radius, Math.PI);
    ctx.fill(path2D);
  }

  private paintLine(ctx: CanvasRenderingContext2D, knot: Knot): void {
    for (const line of knot.lines) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(
        ${line.distance * 4},
        ${line.distance * 4},
        ${line.distance * 4},
        ${(this.connectDist - line.distance) / this.connectDist})`;
      ctx.moveTo(knot.pos.x, knot.pos.y);
      ctx.lineTo(line.target.x, line.target.y);
      ctx.stroke();
    }
  }

  private paintProtection(ctx: CanvasRenderingContext2D, knot: Knot): void {
    if (knot.lines.length > 0) {
      ctx.strokeStyle = `rgba(
        100,
        100,
        100,
        ${(1 / 100) * knot.lineLength})`;
      this.drawBezierCircle(ctx, knot.pos.x, knot.pos.y, knot.radius);
    }
  }

  public createParticles(position: Vector2): void {
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
    this.particles = [...this.particles, ...newParticles];
  }

  private calcNextParticle(): void {
    if (this.ctx) {
      let destroy = false;
      for (const particle of this.particles) {
        if (particle.speed > 1.5) {
          particle.speed -= 0.1;
        }
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

  public removeParticle(amount: number): void {
    this.particles.splice(0, amount);
  }

  private drawBezierCircle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number) {
    this.drawBezierCircleQuarter(ctx, centerX, centerY, -size, size);
    this.drawBezierCircleQuarter(ctx, centerX, centerY, size, size);
    this.drawBezierCircleQuarter(ctx, centerX, centerY, size, -size);
    this.drawBezierCircleQuarter(ctx, centerX, centerY, -size, -size);
  }
  private drawBezierCircleQuarter(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    sizeX: number,
    sizeY: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(centerX - sizeX, centerY - 0);
    ctx.bezierCurveTo(
      centerX - sizeX,
      centerY - 0.552 * sizeY,
      centerX - 0.552 * sizeX,
      centerY - sizeY,
      centerX - 0,
      centerY - sizeY,
    );
    ctx.stroke();
  }
}
