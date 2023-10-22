import { getTailwindColorHexCode } from 'src/app/helper/tailwind-colors';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { ngIconsRecord, iconList } from './icon-list';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  inject,
} from '@angular/core';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons(ngIconsRecord)],
  selector: 'global-icon',
  template: `
    <div
      #ngIcon
      *ngIf="icon !== ''"
      class="flex gap-1 items-center">
      <div *ngIf="fromHttp; else iconTemplate">
        <img
          [ngStyle]="{ width: size }"
          [src]="_icon" />
      </div>
      <ng-template #iconTemplate>
        <ng-icon
          [name]="_icon"
          [strokeWidth]="strokeWidth"
          [size]="size"
          [color]="_color"
          class="duration-200">
        </ng-icon>
      </ng-template>
      <ng-content></ng-content>
    </div>
  `,
})
export class IconComponent implements AfterViewInit {
  private elRef = inject(ElementRef);
  private detector = inject(ChangeDetectorRef);

  public _color = '#d9d9d9'; //is secondary
  @Input() set color(value: string) {
    if (this._color !== '#646464' && this._icon !== 'featherHelpCircle' && value !== '') {
      this._color = getTailwindColorHexCode(value);
    }
  }

  public _icon = '';
  @Input({ required: true }) set icon(value: string) {
    if (value.startsWith('http')) {
      this.fromHttp = true;
      this._icon = value;
    } else {
      this.fromHttp = false;
      this._icon = this.iconExists(value);
    }
  }

  @Input() public strokeWidth: string | number | undefined = 1.5;
  @Input() public size = '1.5rem';
  @Input() public hoverColor = 'primary';
  @Input() public hoverHighlightning = false;

  public fromHttp = false;
  public readonly icons = iconList;

  private mouseEnterEventRef: () => unknown = () => this.onEnter();
  private mouseLeaveEventRef: () => unknown = () => this.onLeave();

  public ngAfterViewInit(): void {
    this.handleListeners(this.hoverHighlightning);
  }

  private handleListeners(hoverListener: boolean): void {
    if (this.elRef && !this.fromHttp) {
      if (hoverListener) {
        this.elRef.nativeElement.addEventListener('mouseenter', this.mouseEnterEventRef);
        this.elRef.nativeElement.addEventListener('mouseleave', this.mouseLeaveEventRef);
      } else {
        removeEventListener('mouseenter', this.mouseEnterEventRef);
        removeEventListener('mouseleave', this.mouseLeaveEventRef);
      }
    }
  }

  private iconExists(icon: string): string {
    if (this.icons.includes(icon)) {
      return icon;
    } else {
      this._color = '#646464';
      return 'featherHelpCircle';
    }
  }

  public onEnter(): void {
    if (this.hoverHighlightning) {
      this._color = getTailwindColorHexCode(this.hoverColor);
      this.detector.detectChanges();
    }
  }

  public onLeave(): void {
    if (this.hoverHighlightning) {
      this._color = getTailwindColorHexCode(this.color);
      this.detector.detectChanges();
    }
  }
}
