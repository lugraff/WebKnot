import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';
import { Vector2, Vector2Service } from './vector2.service';
import { BehaviorSubject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PointerEventService } from './pointer-event.service';
import { LimitNumber } from '../pipes/limit.pipe';
import { drawCircle, drawFilledCircle, drawLine, drawStarN } from '../helper/draw';
import { ResizeObservableService } from './resize-observable.service';

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

function calcPixel(): Vector2 {
  console.log(screen);
  if (screen.orientation.type === 'landscape-primary' || screen.orientation.type === 'landscape-secondary') {
    return { x: 16 * 140, y: 9 * 140 };
  } else {
    return { x: 9 * 140, y: 16 * 140 };
  }
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
  private resize = inject(ResizeObservableService);

  private canvas: HTMLCanvasElement | undefined;
  private canvasContainer: Element | undefined;
  private ctx: CanvasRenderingContext2D | undefined;

  public processing = new BehaviorSubject<boolean>(true);
  public readonly pixelS = signal<Vector2>(calcPixel());
  public readonly canvasScaledPixelS = signal<Vector2>({ x: 0, y: 0 });

  private pointerPos: Vector2 = { x: 0, y: 0 };
  public scaleFactor: Vector2 = { x: 1, y: 1 };
  private knots: Knot[] = [];
  private particles: Particle[] = [];
  private expandTimer: any;
  private loseTimer: any;
  private stopTimer: any;
  private isPressing = false;
  private connectDist = 0;
  private isConnectHalf = false;
  private readonly lineWidth = 4;

  public range = 140;
  public power = 200;

  private minSpeed = 0.3;
  private maxSpeed = 3;
  private damping = 0.005;
  private connectDistTarget = 360;
  private gravitation = 1;

  constructor() {
    this.pointer.pointerPosition.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.pointerPos = { x: event.position.x / this.scaleFactor.x, y: event.position.y / this.scaleFactor.y };
      if (event.pressed !== undefined) {
        this.isPressing = event.pressed;
      }
    });
    // event.index
  }

  public init(): void {
    this.processing
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.ngZone.runOutsideAngular(() => this.process(0)));
    this.canvasContainer = document.getElementById('canvasContainer') as Element;
    this.resize
      .resizeObservable(this.canvasContainer)
      .pipe(takeUntilDestroyed(this.destroy))
      .pipe(debounceTime(100))
      .pipe(distinctUntilChanged())
      .subscribe((v) => {
        this.initCanvas();
      });
    this.tryToCreateKnots();
  }

  private tryToCreateKnots(): void {
    if (this.canvas) {
      this.createKnots(this.canvas, 32);
    } else {
      setTimeout(() => {
        this.tryToCreateKnots();
      }, 103);
    }
  }

  public initCanvas(): void {
    this.canvas?.remove();
    setTimeout(() => {
      const newCanvas = document.createElement('canvas');
      const size = calcPixel();
      newCanvas.id = 'canvas';
      newCanvas.width = size.x;
      newCanvas.height = size.y;
      newCanvas.style.overflow = 'hidden';
      this.canvasContainer = document.getElementById('canvasContainer') as Element;
      this.canvasContainer.appendChild(newCanvas);
      this.canvas = newCanvas;
      if (this.canvasContainer) {
        this.ctx = newCanvas.getContext('2d') as CanvasRenderingContext2D;
        this.ctx.lineCap = 'round';
        this.scaleCanvas();
      }
    }, 0);
  }

  private scaleCanvas(): void {
    if (this.canvasContainer && this.ctx) {
      const scaleX = (1 / this.pixelS().x) * this.canvasContainer.clientWidth;
      const scaleY = (1 / this.pixelS().y) * this.canvasContainer.clientHeight;
      const aspectScale = Math.min(scaleX, scaleY);
      this.scaleFactor = { x: aspectScale, y: aspectScale };
      this.canvasScaledPixelS.set({
        x: this.ctx.canvas.width * this.scaleFactor.x,
        y: this.ctx.canvas.height * this.scaleFactor.y,
      });
      this.ctx.scale(this.scaleFactor.x, this.scaleFactor.y);
    }
  }

  private process(timestamp: number): void {
    if (!this.processing.value) {
      return;
    }
    // this.fpsMeter.calcFPS(timestamp);
    this.calcNextFrame();
    requestAnimationFrame((timestamp) => this.process(timestamp));
  }

  public createKnots(canvas: HTMLCanvasElement, amount: number): void {
    const newKnots: Knot[] = [];
    for (let index = 0; index < amount; index++) {
      let randomSpezial = Math.floor(Math.random() * 30) + 2;
      if (randomSpezial > 6) {
        randomSpezial = 0;
      }
      const newKnot: Knot = {
        pos: {
          x: 0.5 * canvas.clientWidth,
          y: 0.5 * canvas.clientHeight,
        },
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
      this.ctx.clearRect(0, 0, innerWidth / this.scaleFactor.x, this.pixelS().y);
      this.calcNextParticle();
      this.calcConnectionDist();
      for (let index = 0; index < this.knots.length; index++) {
        if (this.isPressing) {
          if (index === 0) {
            this.createParticles(this.pointerPos);
          }
          if (this.calcActions(this.knots[index], index)) {
            continue;
          }
        }
        this.calcConnectionMagnetic(this.knots[index]);
        this.calcSpeed(this.knots[index]);
        this.calcNextPos(this.knots[index]);
        this.calcBorders(this.ctx, this.knots[index]);
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
        knot.dir.x -= magnetic.x * 0.000015 * this.gravitation;
        knot.dir.y -= magnetic.y * 0.000015 * this.gravitation;
        knot.dir.x = this.limit.transform(knot.dir.x, -Math.PI, Math.PI, false);
        knot.dir.y = this.limit.transform(knot.dir.y, -Math.PI, Math.PI, false);
      }
    }
  }

  private calcBorders(ctx: CanvasRenderingContext2D, knot: Knot): void {
    if (knot.pos.y < knot.radius) {
      knot.pos.y = knot.radius;
      knot.dir.y = -knot.dir.y * 0.8;
    } else if (knot.pos.y + knot.radius > ctx.canvas.height) {
      knot.pos.y = ctx.canvas.height - knot.radius;
      knot.dir.y = -knot.dir.y * 0.8;
    }
    if (knot.pos.x < knot.radius) {
      knot.pos.x = knot.radius;
      knot.dir.x = -knot.dir.x * 0.8;
    } else if (knot.pos.x + knot.radius > ctx.canvas.width) {
      knot.pos.x = ctx.canvas.width - knot.radius;
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
      let opacity = (this.connectDist - line.distance) / this.connectDist;
      const strokeStyle = `rgba(256,256,256,${this.limit.transform(opacity, 0, 0.6)})`;
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
        pos: { x: position.x + (Math.random() - 0.5) * 24, y: position.y + (Math.random() - 0.5) * 24 },
        dir: this.vector2.normalize({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        }),
        speed: 5 + index * 0.001 + Math.random() * 3,
        radius: 4,
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
