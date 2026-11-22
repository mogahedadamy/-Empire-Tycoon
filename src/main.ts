/** Renders the province prototype and forwards player actions to its simulation. */
import {
  applyCommand,
  initialWorld,
  COSTS,
  type BuildingKind,
  type World,
} from './simulation';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app root');

let world: World = initialWorld();
let selected: BuildingKind = 'farm';
const kinds: BuildingKind[] = ['farm', 'lumberyard', 'quarry'];
const labels: Record<BuildingKind, string> = {
  farm: 'Farm',
  lumberyard: 'Lumberyard',
  quarry: 'Quarry',
};
const icons: Record<BuildingKind, string> = {
  farm: '✿',
  lumberyard: '♠',
  quarry: '⬟',
};

function buildingButtons() {
  return kinds.map((kind) => {
    const cost = Object.entries(COSTS[kind])
      .filter(([, amount]) => amount > 0)
      .map(([resource, amount]) => `${amount} ${resource}`)
      .join(' · ');

    return `
      <button class="build ${selected === kind ? 'active' : ''}" data-kind="${kind}">
        <span class="build-icon">${icons[kind]}</span>
        <span><strong>${labels[kind]}</strong><small>${cost}</small></span>
      </button>`;
  }).join('');
}

function provinceTiles() {
  return Array.from({ length: 96 }, (_, index) => {
    const x = index % 12;
    const y = Math.floor(index / 12);
    const building = world.buildings.find((item) => item.x === x && item.y === y);
    const label = building ? labels[building.kind] : 'Empty plot';
    const icon = building ? icons[building.kind] : '';

    return `<button class="tile ${building ? 'occupied' : ''}" data-x="${x}" data-y="${y}"
      aria-label="${label} row ${y + 1} column ${x + 1}">${icon}</button>`;
  }).join('');
}

function render(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          <span class="crest">✦</span>
          <div><small>THE IMPERIAL COMMAND</small><h1>Empire Tycoon</h1></div>
        </div>
        <div class="resources">
          <span>◈ <b>${world.gold}</b> Gold</span>
          <span>♧ <b>${world.wood}</b> Wood</span>
          <span>⬡ <b>${world.stone}</b> Stone</span>
        </div>
      </header>
      <section class="layout">
        <aside class="sidebar">
          <div class="eyebrow">EMPIRE OVERVIEW</div>
          <h2>Found your legacy.</h2>
          <p>Build a thriving province. Choose a structure, then select an empty plot.</p>
          <div class="divider"></div>
          <div class="eyebrow">CONSTRUCTION</div>
          <div class="buildings">${buildingButtons()}</div>
          <button id="advance" class="primary">Advance one season →</button>
        </aside>
        <section class="world">
          <div class="world-head">
            <div>
              <div class="eyebrow">PROVINCE 01 / THE FRONTIER</div>
              <h2>The Verdant Marches</h2>
            </div>
            <span class="season">SEASON ${world.tick + 1}</span>
          </div>
          <div class="map" role="group" aria-label="Province building plots">${provinceTiles()}</div>
          <div class="map-footer">
            <span>◉ Select a plot to construct</span>
            <span>${world.buildings.length} structures established</span>
          </div>
        </section>
      </section>
      <footer>EMPIRE TYCOON <span>EARLY PROTOTYPE · NOT FINAL GAMEPLAY</span></footer>
    </main>`;

  root.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((button) =>
    button.addEventListener('click', () => {
      selected = button.dataset.kind as BuildingKind;
      render(root);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-x]').forEach((button) =>
    button.addEventListener('click', () => {
      world = applyCommand(world, {
        type: 'build',
        kind: selected,
        x: Number(button.dataset.x),
        y: Number(button.dataset.y),
      });
      render(root);
    }),
  );
  root.querySelector('#advance')?.addEventListener('click', () => {
    world = applyCommand(world, { type: 'advance', ticks: 1 });
    render(root);
  });
}

render(app);
