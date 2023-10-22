import { Injectable } from '@angular/core';
import { NextObserver, Observable, Subscriber, asyncScheduler, filter, map, throttleTime } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ResizeObservableService {
  private resizeObserver: ResizeObserver;
  private notifiers: NextObserver<ResizeObserverEntry[]>[] = [];

  constructor() {
    this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      this.notifiers.forEach((obs) => obs.next(entries));
    });
  }

  public resizeObservable(elem: Element): Observable<ResizeObserverEntry> {
    this.resizeObserver.observe(elem);
    const newObserverCandidate = new Observable<ResizeObserverEntry[]>(
      (subscriber: Subscriber<ResizeObserverEntry[]>) => {
        this.notifiers.push(subscriber);

        return () => {
          const idx = this.notifiers.findIndex((val) => val === subscriber);
          this.notifiers.splice(idx, 1);
          this.resizeObserver.unobserve(elem);
        };
      },
    );

    return newObserverCandidate.pipe(
      map((entries) => entries.find((entry) => entry.target === elem)),
      filter(Boolean),
      throttleTime(30, asyncScheduler, { trailing: true }),
    );
  }

  public widthResizeObservable(elem: Element): Observable<number> {
    return this.resizeObservable(elem).pipe(
      map((entry) => entry.borderBoxSize[0].inlineSize),
      filter(Boolean),
    );
  }

  public heightResizeObservable(elem: Element): Observable<number> {
    return this.resizeObservable(elem).pipe(
      map((entry) => entry.borderBoxSize[0].blockSize),
      filter(Boolean),
    );
  }
}
