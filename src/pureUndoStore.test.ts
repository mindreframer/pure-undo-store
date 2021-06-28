import createStore from "./PureUndoStore";

interface State {
  numberOfWalks: number;
  animals: {
    name: string;
    age: number;
    isBad?: boolean;
  }[];
}

const state: State = {
  numberOfWalks: 2876,
  animals: [
    {
      name: "Aiofe",
      age: 6,
    },
    {
      name: "Sen",
      age: 8,
    },
  ],
};

const store = createStore(state);

test("Allows access to state", () => {
  const storeState = store.state;

  expect(storeState.numberOfWalks).toBe(2876);
  expect(storeState.animals.length).toBe(2);
  expect(storeState.animals[1].name).toBe("Sen");
});

test("Allow function updates", () => {
  expect(store.state.numberOfWalks).toBe(2876);

  store.update((s) => s.numberOfWalks++);

  expect(store.state.numberOfWalks).toBe(2877);
});

test("Allow object updates", () => {
  store.update({ numberOfWalks: 100 });

  expect(store.state.numberOfWalks).toBe(100);
});

test("More Updating", () => {
  store.update((s) => s.animals.push({ name: "Odin", age: 5 }));

  expect(store.state.animals.length).toBe(3);
});

describe("Sub-stores", () => {
  test("Basic usage", () => {
    const odinStore = store.storeFor((s) => s.animals[2]);

    expect(odinStore.state.name).toBe("Odin");
    expect(odinStore.state.isBad).toBe(undefined);

    odinStore.update({ isBad: true });
    expect(odinStore.state.isBad).toBe(true);
  });

  test("a sub-sub-store", () => {
    const animalsStore = store.storeFor((s) => s.animals);
    const aiofeStore = animalsStore.storeFor((s) => s[0]);

    expect(aiofeStore.state.name).toBe("Aiofe");
  });
});

describe("A store for a single property", () => {
  const walksStore = store.storeFor((s) => s.numberOfWalks);

  test("Can get a single property's state", () => {
    expect(walksStore.state).toBe(100);
  });

  test("Can't update a store with a single property", () => {
    walksStore.update((n) => (n += 50));

    expect(walksStore.state).not.toBe(150);
  });
});

describe("Immutability", () => {
  const senStore = store.storeFor((s) => s.animals[1]);

  test("Unmodified objects stay the same", () => {
    const before = senStore.state;
    const rootBefore = store.state.animals[1];
    expect(before).toBe(rootBefore);

    expect(before).toBe(senStore.state);
    expect(rootBefore).toBe(store.state.animals[1]);
  });

  test("Modified objects are different objects", () => {
    const before = senStore.state;
    const rootBefore = store.state.animals[1];
    expect(before).toBe(rootBefore);

    senStore.update({ isBad: false });

    expect(before).not.toBe(senStore.state);
    expect(rootBefore).not.toBe(store.state.animals[1]);
  });
});

test("Updaters", () => {
  const aiofeUpdater = store.updaterFor((s) => s.animals[0]);

  expect(store.state.animals[0].isBad).toBe(undefined);

  aiofeUpdater((aiofe) => (aiofe.isBad = false));
  expect(store.state.animals[0].isBad).toBe(false);
});

describe("Subscriptions", () => {
  test("subscriptions are called", () => {
    let callbackCalled = false;
    store.subscribe(() => (callbackCalled = true));
    expect(callbackCalled).toBe(false);

    store.update((s) => s.numberOfWalks++);
    expect(callbackCalled).toBe(true);
  });

  test("subscriptions aren't called if data isn't changed", () => {
    let callbackCalled = false;
    store.subscribe(() => (callbackCalled = true));
    expect(callbackCalled).toBe(false);

    const numberOfWalks = store.state.numberOfWalks;
    store.update({ numberOfWalks });
    expect(callbackCalled).toBe(false);
  });

  test("updating with a sub-store trigger subscribed callbacks", () => {
    const senStore = store.storeFor((s) => s.animals[1]);
    let callbackCalled = false;
    store.subscribe(() => (callbackCalled = true));
    senStore.update((s) => s.age++);

    expect(callbackCalled).toBe(true);
  });

  test("subscriptions can be cancelled", () => {
    let count = 0;
    const cancelSubscription = store.subscribe(() => count++);

    store.update((s) => s.numberOfWalks++);
    store.update((s) => s.numberOfWalks++);
    expect(count).toBe(2);

    cancelSubscription();
    store.update((s) => s.numberOfWalks++);
    expect(count).toBe(2);
  });

  test("sub-stores can be subscribed to", () => {
    const senStore = store.storeFor((s) => s.animals[1]);
    let callbackCalled = false;
    senStore.subscribe(() => (callbackCalled = true));
    senStore.update((s) => s.age++);

    expect(callbackCalled).toBe(true);
  });
});

describe("Supports undo/redo", () => {
  it("works for basic things", () => {
    const mystore = createStore(state);
    mystore.update((s) => (s.numberOfWalks = 1000));
    expect(mystore.state.numberOfWalks).toBe(1000);
    mystore.undo();
    expect(mystore.state.numberOfWalks).toBe(2876);
    mystore.undo();
    expect(mystore.state.numberOfWalks).toBe(2876);
    mystore.redo();
    expect(mystore.state.numberOfWalks).toBe(1000);
    mystore.redo();
    expect(mystore.state.numberOfWalks).toBe(1000);
  });

  it("works for substores", () => {
    const mystore = createStore(state);
    mystore.update((s) => s.animals.push({ name: "Odin", age: 5 }));
    const odinStore = mystore.storeFor((s) => s.animals[2]);
    expect(odinStore.state.name).toBe("Odin");
    odinStore.update((s) => (s.name = "NewOdin"));
    odinStore.undo();
    expect(odinStore.state.name).toBe("Odin");
    odinStore.redo();
    expect(odinStore.state.name).toBe("NewOdin");
    mystore.undo();
    expect(odinStore.state).toMatchInlineSnapshot(`
Object {
  "age": 5,
  "name": "Odin",
}
`);
    mystore.redo();
    expect(odinStore.state).toMatchInlineSnapshot(`
Object {
  "age": 5,
  "name": "NewOdin",
}
`);
    expect(odinStore.patches).toMatchInlineSnapshot(`Array []`);
    expect(mystore.patches).toMatchSnapshot();
    expect(odinStore.state).toMatchInlineSnapshot(`
Object {
  "age": 5,
  "name": "NewOdin",
}
`);
  });

  it("resets forward patches on updates", () => {
    const mystore = createStore(state);
    mystore.update((s) => s.animals.push({ name: "Odin", age: 5 }));
    mystore.update((s) => s.animals.push({ name: "Animal-4", age: 4 }));
    mystore.update((s) => s.animals.push({ name: "Animal-5", age: 5 }));
    expect(mystore.state.animals.length).toBe(5);
    mystore.undo();
    mystore.undo();
    expect(mystore.state.animals.length).toBe(3);
    // this should discard old forward history
    mystore.update((s) => s.animals.push({ name: "Animal-4", age: 4 }));
    expect(mystore.historyPointer).toBe(1);
    expect(mystore.state.animals.length).toBe(4);
    mystore.redo();
    expect(mystore.state.animals.length).toBe(4);
    mystore.redo();
    expect(mystore.state.animals.length).toBe(4);
    mystore.undo();
    expect(mystore.state.animals.length).toBe(3);
  });
  interface StoreWithKeys {
    animals: { [key: number]: { name: string } };
  }

  it("provides an option to update without undo", () => {
    const mystore = createStore<StoreWithKeys>({
      animals: {
        1: { name: "a" },
        2: { name: "b" },
      },
    });
    mystore.update((s) => (s.animals[3] = { name: "c" }));
    mystore.updateWithoutPatches((s) => (s.animals[4] = { name: "d" })); // is not subject to undo/redo patches
    mystore.undo();
    expect(mystore.state.animals).toMatchInlineSnapshot(`
Object {
  "1": Object {
    "name": "a",
  },
  "2": Object {
    "name": "b",
  },
  "4": Object {
    "name": "d",
  },
}
`);
    mystore.redo();
    expect(mystore.state.animals).toMatchInlineSnapshot(`
Object {
  "1": Object {
    "name": "a",
  },
  "2": Object {
    "name": "b",
  },
  "3": Object {
    "name": "c",
  },
  "4": Object {
    "name": "d",
  },
}
`);
  });

  it("does not record duplicates", () => {
    const mystore = createStore(state);
    mystore.update((s) => (s.numberOfWalks = 1000));
    mystore.update((s) => (s.numberOfWalks = 1000));
    mystore.update((s) => (s.numberOfWalks = 1000));
    mystore.update((s) => (s.numberOfWalks = 1000));
    expect(mystore.patches.length).toBe(1);
  });
});
