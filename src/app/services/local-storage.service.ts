import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  public getItem(key: string): any {
    if (navigator.cookieEnabled) {
      return localStorage.getItem(key);
    }
    return null;
  }

  public setItem(key: string, data: string): void {
    if (navigator.cookieEnabled) {
      localStorage.setItem(key, data);
    }
  }

  public removeItem(key: string): void {
    if (navigator.cookieEnabled) {
      localStorage.removeItem(key);
    }
  }

  public clearStorage(): void {
    if (navigator.cookieEnabled) {
      localStorage.clear();
    }
  }

  public setObject(storageItemName: string, object: object): void {
    if (navigator.cookieEnabled) {
      localStorage.setItem(storageItemName, JSON.stringify(object));
    }
  }

  public getObject(storageItemName: string): any {
    if (navigator.cookieEnabled) {
      const result = JSON.parse(localStorage.getItem(storageItemName) ?? '{}');
      return result;
    }
    return undefined;
  }

  public mutateObject(storageItemName: string, key: string, value: any): void {
    if (navigator.cookieEnabled) {
      const savedObject: { [key: string]: any } = JSON.parse(localStorage.getItem(storageItemName) ?? '{}');
      savedObject[key] = value;
      localStorage.setItem(storageItemName, JSON.stringify(savedObject));
    }
  }

  public getFromObject(storageItemName: string, key: string): any {
    if (navigator.cookieEnabled) {
      const result = JSON.parse(localStorage.getItem(storageItemName) ?? '{}');
      return result[key];
    }
    return undefined;
  }
}
