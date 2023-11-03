import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Vector2, Vector2Service } from './vector2.service';
import { BehaviorSubject, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PointerEventService } from './pointer-event.service';
import { LimitNumber } from '../pipes/limit.pipe';
import { drawCircle, drawFilledCircle, drawLine, drawStarN } from '../helper/draw';

interface Particle {
  pos: Vector2;
  dir: Vector2;
  speed: number;
  radius: number;
  lifetime: number;
}
interface Line {
  target: Vector2;
  distance: number;
}
interface Knot {
  pos: Vector2;
  dir: Vector2;
  speed: number;
  radius: number;
  lines: Line[];
  lineLength: number;
  special: number;
}

@Injectable({
  providedIn: 'root',
})
export class WebKnotService {
  private vector2 = inject(Vector2Service);
  private ngZone = inject(NgZone);
  private destroy = inject(DestroyRef);
  private pointer = inject(PointerEventService);
  private limit = inject(LimitNumber);

  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  public processing = new BehaviorSubject<boolean>(true);

  private pointerPos: Vector2 = { x: 0, y: 0 };
  private knots: Knot[] = [];
  private particles: Particle[] = [];
  private expandTimer: any;
  private loseTimer: any;
  private stopTimer: any;
  private isPressing = false;
  private connectDist = 0;
  private isConnectHalf = false;
  private readonly lineWidth = 2;

  public range = 120;
  public power = 64;

  private minSpeed = 0.3;
  private maxSpeed = 3;
  private damping = 0.005;
  private connectDistTarget = 140;
  private gravitation = 1;

  constructor() {
    this.pointer.pointerPosition.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.pointerPos = { x: event.position.x, y: event.position.y };
      if (event.pressed !== undefined) {
        this.isPressing = event.pressed;
      }
    });
    // event.index
  }

  public initCanvas(elementId: string): void {
    this.canvas = document.getElementById(elementId) as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
      this.ctx.lineCap = 'round';
      // this.ctx.scale(0.5, 0.5);
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
      let randomSpezial = Math.floor(Math.random() * 3) + 2;
      if (randomSpezial > 6) {
        randomSpezial = 0;
      }
      const newKnot: Knot = {
        pos: { x: 0.5 * window.innerWidth, y: 0.5 * window.innerHeight },
        dir: this.vector2.normalize({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        }),
        speed: Math.random() * this.maxSpeed,
        radius: 10 * this.lineWidth,
        lines: [],
        lineLength: 0,
        special: randomSpezial,
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
      this.calcConnectionDist();
      for (let index = 0; index < this.knots.length; index++) {
        if (this.isPressing) {
          if (this.calcActions(this.knots[index], index)) {
            continue;
          }
        }
        this.calcConnectionMagnetic(this.knots[index]);
        this.calcSpeed(this.knots[index]);
        this.calcNextPos(this.knots[index]);
        this.calcBorders(this.knots[index]);
        this.calcConnections(index);
        this.drawLines(this.ctx, this.knots[index]);
        this.drawKnot(this.ctx, this.knots[index]);
        this.drawProtection(this.ctx, this.knots[index]);
        this.drawSpezial(this.ctx, this.knots[index]);
      }
      this.isPressing = false;
    }
  }

  private calcActions(knot: Knot, index: number): boolean {
    const distance = this.vector2.distance(knot.pos, this.pointerPos);
    if (distance < this.range) {
      if (distance < knot.radius && knot.lines.length <= 0) {
        this.createParticles(knot.pos);
        this.removeKnot(index);
        if (knot.special > 1) {
          this.fireSpezial(knot.special);
        }
        return true;
      }
      knot.dir = this.vector2.normalize(this.vector2.sub(knot.pos, this.pointerPos));
      knot.speed = (this.power / distance) * 10;
    }
    return false;
  }

  private calcSpeed(knot: Knot): void {
    if (knot.speed < this.minSpeed) {
      knot.speed += 0.01;
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
    const lines: Line[] = [];
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
      if (line.distance > knot.radius) {
        const magnetic = this.vector2.sub(knot.pos, line.target);
        knot.dir.x -= magnetic.x * 0.00007 * this.gravitation;
        knot.dir.y -= magnetic.y * 0.00007 * this.gravitation;
        knot.dir.x = this.limit.transform(knot.dir.x, -Math.PI, Math.PI, false);
        knot.dir.y = this.limit.transform(knot.dir.y, -Math.PI, Math.PI, false);
      }
    }
  }

  private calcBorders(knot: Knot): void {
    if (knot.pos.y < knot.radius) {
      knot.pos.y = knot.radius;
      knot.dir.y = -knot.dir.y * 0.8;
    } else if (knot.pos.y + knot.radius > window.innerHeight) {
      knot.pos.y = window.innerHeight - knot.radius;
      knot.dir.y = -knot.dir.y * 0.8;
    }
    if (knot.pos.x < knot.radius) {
      knot.pos.x = knot.radius;
      knot.dir.x = -knot.dir.x * 0.8;
    } else if (knot.pos.x + knot.radius > window.innerWidth) {
      knot.pos.x = window.innerWidth - knot.radius;
      knot.dir.x = -knot.dir.x * 0.8;
    }
  }

  private calcConnectionDist(): void {
    if (this.connectDist < this.connectDistTarget - 1) {
      this.connectDist += 1;
    } else if (this.connectDist > this.connectDistTarget + 1) {
      this.connectDist -= 1;
    }
    this.connectDist = Math.floor(this.connectDist);
  }

  private drawKnot(ctx: CanvasRenderingContext2D, knot: Knot): void {
    const gradient = ctx.createRadialGradient(knot.pos.x, knot.pos.y, 0.5, knot.pos.x, knot.pos.y, knot.radius);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'transparent');
    drawFilledCircle(ctx, knot.pos, knot.radius, gradient);
  }

  private drawSpezial(ctx: CanvasRenderingContext2D, knot: Knot): void {
    if (knot.special >= 2) {
      const strokeStyle = `rgba(256,256,256,0.3)`;
      drawStarN(ctx, knot.pos, knot.radius, knot.special, strokeStyle, this.lineWidth);
    }
  }

  private drawLines(ctx: CanvasRenderingContext2D, knot: Knot): void {
    for (const line of knot.lines) {
      const strokeStyle = `rgba(256,256,256,${(this.connectDist - line.distance) / this.connectDist})`;
      drawLine(ctx, knot.pos, line.target, strokeStyle, this.lineWidth);
    }
  }

  private drawProtection(ctx: CanvasRenderingContext2D, knot: Knot): void {
    if (knot.lines.length > 0) {
      const strokeStyle = `rgba(100,100,100,${(1 / 100) * knot.lineLength})`;
      drawCircle(ctx, knot.pos.x, knot.pos.y, knot.radius, strokeStyle, this.lineWidth);
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
        particle.pos.x += particle.dir.x * particle.speed;
        particle.pos.y += particle.dir.y * particle.speed;
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
    const fillStyle = `rgba(256,256,256,${(1 / 60) * particle.lifetime})`;
    drawFilledCircle(ctx, particle.pos, particle.radius, fillStyle);
  }

  public removeParticle(amount: number): void {
    this.particles.splice(0, amount);
  }

  private fireSpezial(spezial: number): void {
    switch (spezial) {
      case 2:
        this.disturb();
        break;
      case 3:
        this.stop();
        break;
      case 4:
        this.expand();
        break;
      case 5:
        //score
        break;
      case 6:
        this.detonation();
        break;
      default:
        break;
    }
  }

  private detonation(): void {
    for (let index = 0; index < this.knots.length - 1; index++) {
      if (this.knots[index].lines.length <= 0) {
        this.createParticles(this.knots[index].pos);
      }
    }
    this.knots = this.knots.filter((knot) => knot.lines.length > 0);
  }

  private stop(): void {
    clearTimeout(this.stopTimer);
    for (const knot of this.knots) {
      knot.dir = { x: 0, y: 0 };
      knot.speed = 0;
    }
    const lastMinSpeed = this.minSpeed;
    this.minSpeed = 0;
    this.ngZone.runOutsideAngular(() => {
      this.stopTimer = setTimeout(() => {
        this.minSpeed = lastMinSpeed;
      }, 1111);
    });
  }

  private expand(): void {
    clearTimeout(this.expandTimer);
    this.gravitation = -9;
    this.ngZone.runOutsideAngular(() => {
      this.expandTimer = setTimeout(() => {
        this.gravitation = 1;
      }, 7777);
    });
  }

  private disturb(): void {
    if (this.isConnectHalf) {
      //TODO timeout wieder verlängern!
      return;
    }
    this.isConnectHalf = true;
    const lastConnectDistTarget = this.connectDist;
    this.connectDistTarget *= 0.5;
    this.ngZone.runOutsideAngular(() => {
      this.loseTimer = setTimeout(() => {
        this.connectDistTarget = lastConnectDistTarget;
        this.isConnectHalf = false;
      }, 3333);
    });
  }
}
