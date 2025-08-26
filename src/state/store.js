import { create } from 'zustand';
import { saveState, loadState } from './persistence.js';

export const useStore = create((set, get) => ({
  // Start players with a few daisy seeds in their inventory
  inventory: [{ id: 'seed_daisy', type: 'seed', count: 3 }],
  isInventoryOpen: false,
  isPaused: false,
  keyBindings: {
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    sprint: 'ShiftLeft'
  },
  volume: 1,
  mouseSensitivity: 0.002,
  bobEnabled: true,
  addItem: (item) => {
    set((state) => {
      const inventory = [...state.inventory];
      const index = inventory.findIndex((i) => i.id === item.id);
      if (index >= 0) {
        const existing = inventory[index];
        const count = existing.count || 1;
        inventory[index] = { ...existing, count: count + (item.count || 1) };
      } else {
        inventory.push({ ...item, count: item.count || 1 });
      }
      return { inventory };
    });
  },
  removeItem: (id, amount = 1) => {
    set((state) => {
      const inventory = state.inventory.map((i) => ({ ...i }));
      const index = inventory.findIndex((i) => i.id === id);
      if (index >= 0) {
        const item = inventory[index];
        const count = (item.count || 1) - amount;
        if (count > 0) {
          inventory[index] = { ...item, count };
        } else {
          inventory.splice(index, 1);
        }
      }
      return { inventory };
    });
  },
  toggleInventory: () => set((state) => ({ isInventoryOpen: !state.isInventoryOpen })),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setKeyBinding: (action, code) =>
    set((state) => ({ keyBindings: { ...state.keyBindings, [action]: code } })),
  setVolume: (volume) => set({ volume }),
  setMouseSensitivity: (mouseSensitivity) => set({ mouseSensitivity }),
  setBobEnabled: (bobEnabled) => set({ bobEnabled }),
  setState: (newState) => set(newState, true),
}));

loadState().then((data) => {
  if (data) {
    useStore.getState().setState(data);
  }
});

useStore.subscribe((state) => {
  const {
    inventory,
    isInventoryOpen,
    keyBindings,
    volume,
    mouseSensitivity,
    bobEnabled,
  } = state;
  saveState({
    inventory,
    isInventoryOpen,
    keyBindings,
    volume,
    mouseSensitivity,
    bobEnabled,
  });
});
