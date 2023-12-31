import { Injectable } from '@angular/core';

export interface Vector2 {
  x: number;
  y: number;
}

@Injectable({
  providedIn: 'root',
})
export class Vector2Service {
  public normalize(vector2: Vector2): Vector2 {
    const normalizedVector2: Vector2 = vector2;
    const m = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
    normalizedVector2.x /= m;
    normalizedVector2.y /= m;
    return normalizedVector2;
  }

  public distance(vector2A: Vector2, vector2B: Vector2): number {
    return Math.sqrt(
      (vector2A.x - vector2B.x) * (vector2A.x - vector2B.x) + (vector2A.y - vector2B.y) * (vector2A.y - vector2B.y),
    );
  }
  //Andere Methode sind dann aber nicht pixel...
  // public distance(vector2A: Vector2, vector2B: Vector2): number {
  //   return Math.pow(vector2A.x - vector2B.x, 2) + Math.pow(vector2A.y - vector2B.y, 2);
  // }

  public sub(vector2A: Vector2, vector2B: Vector2): Vector2 {
    return {
      x: vector2A.x - vector2B.x,
      y: vector2A.y - vector2B.y,
    };
  }

  public invSub(vector2A: Vector2, vector2B: Vector2): Vector2 {
    return {
      x: -(vector2A.x - vector2B.x),
      y: -(vector2A.y - vector2B.y),
    };
  }

  public multiply(vector2: Vector2, multi: number): Vector2 {
    return {
      x: vector2.x * multi,
      y: vector2.y * multi,
    };
  }
}
