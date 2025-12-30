export declare class EventEmitter<T> {
  private subscribers;
  on(event: T, callback: (...args: unknown[]) => void): void;
  emit(event: T, ...args: unknown[]): void;
}
