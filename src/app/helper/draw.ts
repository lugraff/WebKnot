import { Vector2 } from '../services/vector2.service';

export function drawFilledCircle(
  ctx: CanvasRenderingContext2D,
  origin: Vector2,
  radius: number,
  fillStyle: CanvasPattern | CanvasGradient | string,
) {
  ctx.fillStyle = fillStyle;
  const path2D = new Path2D();
  path2D.arc(origin.x, origin.y, radius, 0, 2 * Math.PI);
  ctx.fill(path2D);
}

export function drawStarN(
  ctx: CanvasRenderingContext2D,
  origin: Vector2,
  radius: number,
  n: number,
  strokeStyle: string,
  lineWidth: number,
) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(origin.x + radius, origin.y);
  for (var i = 1; i <= n * 2; i++) {
    if (i % 2 == 0) {
      var theta = (i * (Math.PI * 2)) / (n * 2);
      var x = origin.x + radius * Math.cos(theta);
      var y = origin.y + radius * Math.sin(theta);
    } else {
      var theta = (i * (Math.PI * 2)) / (n * 2);
      var x = origin.x + (radius / 2) * Math.cos(theta);
      var y = origin.y + (radius / 2) * Math.sin(theta);
    }
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  strokeStyle: string,
  lineWidth: number,
) {
  ctx.strokeStyle = strokeStyle;

  drawBezierCircleQuarter(ctx, centerX, centerY, -size, size);
  drawBezierCircleQuarter(ctx, centerX, centerY, size, size);
  drawBezierCircleQuarter(ctx, centerX, centerY, size, -size);
  drawBezierCircleQuarter(ctx, centerX, centerY, -size, -size);
}

function drawBezierCircleQuarter(
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

export function drawLine(
  ctx: CanvasRenderingContext2D,
  origin: Vector2,
  target: Vector2,
  strokeStyle: string,
  lineWidth: number,
) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
}
