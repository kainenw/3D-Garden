import { create } from 'zustand';
import { saveState, loadState } from './persistence.js';

export const useStore = create((set, get) => ({
  inventory: [],
  isInventoryOpen: false,
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
  setState: (newState) => set(newState, true),
}));

loadState().then((data) => {
  if (data) {
    useStore.getState().setState(data);
  }
});

useStore.subscribe((state) => {
  const { inventory, isInventoryOpen } = state;
  saveState({ inventory, isInventoryOpen });
});
