import { useStore } from '../state/store.js';

export class InventoryUI {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'inventory';
    this.container.style.display = 'none';
    this.container.innerHTML = `<div class="grid"></div>`;
    document.body.appendChild(this.container);

    const style = document.createElement('style');
    style.textContent = `
      #inventory {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        padding: 10px;
        color: white;
        z-index: 1000;
      }
      #inventory .grid {
        display: grid;
        grid-template-columns: repeat(5, 64px);
        grid-auto-rows: 64px;
        gap: 4px;
      }
      #inventory .slot {
        width: 64px;
        height: 64px;
        border: 1px solid #555;
        position: relative;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #inventory .slot .count {
        position: absolute;
        right: 2px;
        bottom: 2px;
        background: rgba(0,0,0,0.6);
        padding: 1px 3px;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);

    this.grid = this.container.querySelector('.grid');

    useStore.subscribe((state) => {
      this.render(state.inventory);
      this.container.style.display = state.isInventoryOpen ? 'block' : 'none';
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        useStore.getState().toggleInventory();
      }
    });

    // initial render
    const state = useStore.getState();
    this.render(state.inventory);
    this.container.style.display = state.isInventoryOpen ? 'block' : 'none';
  }

  render(inventory) {
    this.grid.innerHTML = '';
    inventory.forEach((item) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.textContent = item.name || item.id;
      if (item.count > 1) {
        const count = document.createElement('div');
        count.className = 'count';
        count.textContent = item.count;
        slot.appendChild(count);
      }
      this.grid.appendChild(slot);
    });
  }
}
