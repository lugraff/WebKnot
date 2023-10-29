import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Vector2, Vector2Service } from './vector2.service';
import { BehaviorSubject } from 'rxjs';
import { FpsMeterService } from './fps-meter.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PointerEventService } from './pointer-event.service';

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

  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  public processing = new BehaviorSubject<boolean>(true);

  private pointerPos: Vector2 = { x: 0, y: 0 };
  public range = 120;
  public power = 64;
  public radius = 32;

  private knots: Knot[] = [];
  private particles: Particle[] = [];
  private connectDist = 140;
  private minSpeed = 0.3;
  private maxSpeed = 5;
  private damping = 0.005;
  private lineWidth = 5;
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
        radius: 0,
        lines: [],
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
        this.paintBall(this.ctx, this.knots[index]);
        // this.paintSquare(this.ctx, this.knots[index]);
      }
      this.isPressing = false;
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
    if (ball.speed < this.minSpeed) {
      ball.speed = this.minSpeed;
    } else {
      ball.speed -= this.damping;
    }
    if (ball.speed > this.maxSpeed) {
      ball.speed = this.maxSpeed;
    }
  }

  private calcNextPos(ball: Knot): void {
    ball.pos.x += ball.dir.x * ball.speed;
    ball.pos.y += ball.dir.y * ball.speed;
  }

  private calcConnections(knotIndex: number): void {
    const knot = this.knots[knotIndex];
    const lines: Lines[] = [];
    let distanceTotal = 0;
    for (let index = knotIndex; index < this.knots.length; index++) {
      const target: Vector2 = this.knots[index].pos;
      const distance = this.vector2.distance(knot.pos, target);
      if (distance < this.connectDist) {
        lines.push({ target, distance });
        distanceTotal += this.connectDist - distance;
      }
    }
    let radius = Math.round(this.radius * 10 - distanceTotal) * 0.1;
    if (radius < this.lineWidth) {
      radius = this.lineWidth;
    }
    knot.radius = radius;
    knot.lines = lines;
  }

  private calcConnectionMagnetic(knot: Knot): void {
    for (const line of knot.lines) {
      const magnetic = this.vector2.sub(knot.pos, line.target);
      knot.dir.x -= magnetic.x * 0.00008;
      knot.dir.y -= magnetic.y * 0.00008;
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

  private paintBall(ctx: CanvasRenderingContext2D, knot: Knot): void {
    ctx.fillStyle = '#aaaaaa';
    const circle = new Path2D();
    circle.arc(knot.pos.x, knot.pos.y, knot.radius, 0, 2 * Math.PI);
    ctx.fill(circle);
  }

  private paintSquare(ctx: CanvasRenderingContext2D, knot: Knot): void {
    ctx.fillStyle = '#aaaaaa';
    const path2D = new Path2D();
    path2D.roundRect(knot.pos.x - knot.radius * 0.5, knot.pos.y - knot.radius * 0.5, knot.radius, knot.radius, Math.PI);
    ctx.fill(path2D);
  }

  // private paintTest(ctx: CanvasRenderingContext2D, ball: Knot): void {
  //   ctx.fillStyle = '#aaaaaa';
  //   const path2D = new Path2D();
  //   path2D.ellipse(ball.pos.x - ball.radius * 0.5, ball.pos.y - ball.radius * 0.5, ball.radius, ball.radius);
  //   ctx.fill(path2D);
  // }

  private paintLine(ctx: CanvasRenderingContext2D, ball: Knot): void {
    for (const line of ball.lines) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(
        ${line.distance * 4},
        ${line.distance * 4},
        ${line.distance * 4},
        ${(this.connectDist - line.distance) / this.connectDist})`;
      ctx.moveTo(ball.pos.x, ball.pos.y);
      ctx.lineTo(line.target.x, line.target.y);
      ctx.stroke();
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
}
