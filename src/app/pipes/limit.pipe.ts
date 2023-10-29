import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'limitNumber',
  standalone: true,
})
export class LimitNumber implements PipeTransform {
  transform(value: number, min: number, max: number, loop = false): number {
    if (value < min) {
      if (loop) {
        value = max;
      } else {
        value = min;
      }
    } else if (value > max) {
      if (loop) {
        value = min;
      } else {
        value = max;
      }
    }
    return value;
  }
}
