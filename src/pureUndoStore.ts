import produce from "immer";
import { enablePatches, produceWithPatches, applyPatches } from "immer";
enablePatches();
export class PureUndoStore<S, T> {
  callbacks = [];
  rootState: T | undefined;
  getter: (s: S) => T;
  root: any;
  parent: any;

  patches: any[] = [];
  invPatches: any[] = [];
  // we start at -1, because 0 would be the first element
  historyPointer = -1;

  constructor(parent: any, getter: (s: S) => T, rootState?: T) {
    this.parent = parent;
    this.root = (parent && parent.root) || this;
    if (!parent) this.rootState = rootState;
    this.getter = (s: S) => getter(parent ? parent.getter(s) : s);
  }

  getState = () => this.getter(this.root.rootState);
  get state() {
    return this.getState();
  }

  isRoot = () => {
    return this.root == this;
  };

  updateWithoutPatches = (updater: ((e: T) => void) | Partial<T>) => {
    const updaterFn =
      updater instanceof Function
        ? updater
        : (e: any) => Object.assign(e, updater);

    const oldState = this.root.rootState;

    this.root.rootState = produce(this.root.rootState, (s: any) => {
      updaterFn(this.getter(s));
    });

    if (this.root.rootState !== oldState) {
      this.root.callbacks.forEach((callback: () => void) => callback());
    }
  };

  update = (updater: ((e: T) => void) | Partial<T>) => {
    const updaterFn =
      updater instanceof Function
        ? updater
        : (e: any) => Object.assign(e, updater);

    const oldState = this.root.rootState;
    // @ts-ignore
    const [state, patches, invPatches] = produceWithPatches(
      this.root.rootState,
      (s: any) => {
        updaterFn(this.getter(s));
      }
    );
    this.root.rootState = state;
    if (this.root.rootState !== oldState) {
      this.resetHistoryForward();
      this.root.patches.push(patches);
      this.root.invPatches.push(invPatches);
      this.root.historyPointer = this.root.historyPointer + 1;
      this.root.callbacks.forEach((callback: () => void) => callback());
    }
  };

  resetHistoryForward = () => {
    this.root.patches.length = this.root.historyPointer + 1;
    this.root.invPatches.length = this.root.historyPointer + 1;
  };

  canRedo = () => {
    return !(this.root.historyPointer == this.root.patches.length - 1);
  };

  canUndo = () => {
    return !(this.root.historyPointer < 0);
  };

  redo = () => {
    if (!this.isRoot()) {
      return this.root.redo();
    }
    if (!this.canRedo()) {
      return;
    }
    this.historyPointer++;
    const oldState = this.rootState;
    this.rootState = applyPatches(
      this.rootState!,
      this.patches[this.historyPointer]
    );
    this.triggerCallbacks(oldState);
  };

  undo = () => {
    if (!this.isRoot()) {
      return this.root.undo();
    }
    if (!this.canUndo()) {
      return;
    }
    const oldState = this.rootState;
    this.rootState = applyPatches(
      this.rootState!,
      this.invPatches[this.historyPointer]
    );
    this.historyPointer--;
    this.triggerCallbacks(oldState);
  };

  clearHistory = () => {
    this.root.patches = [];
    this.root.invPatches = [];
    this.root.historyPointer = -1;
  };

  triggerCallbacks = (oldState: any) => {
    if (this.rootState !== oldState) {
      this.callbacks.forEach((callback: () => void) => callback());
    }
  };

  storeFor = <X>(getter: (s: T) => X) => new PureUndoStore(this, getter);
  updaterFor = <X>(getter: (s: T) => X) => this.storeFor(getter).update;

  subscribe = (callback: any) => {
    this.root.callbacks.push(callback);
    return () =>
      this.root.callbacks.splice(this.root.callbacks.indexOf(callback), 1);
  };
}

export default <S>(state: S) => new PureUndoStore(null, (s: S) => s, state);
