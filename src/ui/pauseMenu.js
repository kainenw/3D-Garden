import { useStore } from '../state/store.js';

export class PauseMenu {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'pause-menu';
    this.container.style.display = 'none';
    this.container.innerHTML = `
      <div class="menu">
        <h2>Paused</h2>
        <div class="section" id="bindings"></div>
        <div class="section">
          <label>Volume <input type="range" id="volume" min="0" max="1" step="0.01"></label>
        </div>
        <div class="section">
          <label>Mouse Sensitivity <input type="range" id="sensitivity" min="0.001" max="0.01" step="0.0005"></label>
        </div>
        <div class="section">
          <label><input type="checkbox" id="bob"> Enable Motion Bob</label>
        </div>
      </div>`;
    document.body.appendChild(this.container);

    const style = document.createElement('style');
    style.textContent = `
      #pause-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        color: white;
      }
      #pause-menu .menu { background: rgba(0,0,0,0.8); padding: 20px; }
      #pause-menu .section { margin: 10px 0; }
      #pause-menu button { margin-left: 8px; }
    `;
    document.head.appendChild(style);

    this.bindingsDiv = this.container.querySelector('#bindings');
    this.volumeInput = this.container.querySelector('#volume');
    this.sensitivityInput = this.container.querySelector('#sensitivity');
    this.bobInput = this.container.querySelector('#bob');

    const state = useStore.getState();
    this.volumeInput.value = state.volume;
    this.sensitivityInput.value = state.mouseSensitivity;
    this.bobInput.checked = state.bobEnabled;
    this.renderBindings(state.keyBindings);

    useStore.subscribe((state) => {
      this.container.style.display = state.isPaused ? 'flex' : 'none';
      this.volumeInput.value = state.volume;
      this.sensitivityInput.value = state.mouseSensitivity;
      this.bobInput.checked = state.bobEnabled;
      this.renderBindings(state.keyBindings);
    });

    this.volumeInput.addEventListener('input', (e) => {
      useStore.getState().setVolume(parseFloat(e.target.value));
    });
    this.sensitivityInput.addEventListener('input', (e) => {
      useStore.getState().setMouseSensitivity(parseFloat(e.target.value));
    });
    this.bobInput.addEventListener('change', (e) => {
      useStore.getState().setBobEnabled(e.target.checked);
    });
  }

  renderBindings(bindings) {
    this.bindingsDiv.innerHTML = '<h3>Key Bindings</h3>';
    Object.keys(bindings).forEach((action) => {
      const row = document.createElement('div');
      row.textContent = action + ':';
      const button = document.createElement('button');
      button.textContent = bindings[action];
      button.addEventListener('click', () => {
        button.textContent = 'Press key';
        const onKey = (e) => {
          e.preventDefault();
          useStore.getState().setKeyBinding(action, e.code);
          button.textContent = e.code;
          window.removeEventListener('keydown', onKey);
        };
        window.addEventListener('keydown', onKey);
      });
      row.appendChild(button);
      this.bindingsDiv.appendChild(row);
    });
  }
}
