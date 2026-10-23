// Tester för den motoroberoende spellogiken. Körs med:
//   node tests/logic.test.mjs
// Laddar js/*.js i en Node-kontext (ingen webbläsare, ingen 3D).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const ctx = { console, Math, Date, performance: { now: () => 0 }, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary') };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['core', 'audio', 'world', 'environment', 'entities', 'companions']) {
  vm.runInContext(readFileSync(root + 'js/' + f + '.js', 'utf8'), ctx, { filename: f + '.js' });
}
const SV = ctx.SV;
SV.Sfx.play = () => {};

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    console.error('  ✗ ' + name + '\n    ' + e.message);
    process.exitCode = 1;
  }
}

// Minimal spelvärld för logiken (samma gränssnitt som Game).
function makeGame() {
  const world = new SV.World();
  const game = {
    world,
    env: new SV.EnvironmentController(),
    robots: [],
    pickups: [],
    projectiles: [],
    fx: [],
    decoy: null,
    playerDown: false,
    toast() {},
    floater() {},
    addFx(f) {
      this.fx.push(f);
    },
    shake() {},
    spawnLoot() {},
    onRobotDisabled() {},
    detectionMod() {
      return 1;
    },
    toWorldDir: (x, y) => [x, y],
  };
  game.player = new SV.Player(world.spawn.x, world.spawn.y);
  game.companions = new SV.CompanionManager(game);
  game.companions.unlock('dog', true);
  return game;
}

console.log('Djurkompisar (GDD §5.1 CompanionBase)');
test('add_xp når nivå 2 vid 100 och nivå 3 vid 350, xp nollställs', () => {
  const c = new SV.Companions.dog();
  c.add_xp(99);
  assert.equal(c.current_level, 1);
  c.add_xp(1);
  assert.equal(c.current_level, 2);
  assert.equal(c.current_xp, 0);
  c.add_xp(349);
  assert.equal(c.current_level, 2);
  c.add_xp(1);
  assert.equal(c.current_level, 3);
  c.add_xp(1000);
  assert.equal(c.current_level, 3);
});
test('signalerna level_changed och super_ready skickas', () => {
  const c = new SV.Companions.fox();
  const levels = [];
  let ready = 0;
  c.on('level_changed', (l) => levels.push(l));
  c.on('super_ready', () => ready++);
  c.add_xp(100);
  c.add_xp(350);
  assert.deepEqual(levels, [2, 3]);
  assert.equal(ready, 1);
  assert.equal(c.is_super_available, true);
});
test('trigger_super fungerar bara på nivå 3 och förbrukar mätaren', () => {
  const g = makeGame();
  const dog = g.companions.active;
  assert.equal(dog.trigger_super(g), false);
  dog.add_xp(100);
  dog.add_xp(350);
  assert.equal(dog.trigger_super(g), true);
  assert.equal(dog.is_super_available, false);
  assert.equal(dog.super_meter, 0);
  assert.equal(dog.trigger_super(g), false);
  dog.charge_super(100);
  assert.equal(dog.is_super_available, true);
});
test('alla sex arter finns och har tre nivåbeskrivningar', () => {
  assert.equal(Object.keys(SV.Companions).sort().join(','), 'beaver,dog,fox,lynx,moose,owl');
  Object.values(SV.COMPANION_INFO).forEach((i) => assert.equal(i.levels.length, 3));
});

console.log('Sköldskall mot robotarnas stun (GDD §6.3)');
test('robotar inom räckvidd paralyseras i 4 s, robotar långt bort påverkas inte', () => {
  const g = makeGame();
  const dog = g.companions.active;
  dog.placeAt(800, 800);
  const near = [0, 1, 2, 3].map((i) => new SV.Robot('hound', 800 + Math.cos(i) * 60, 800 + Math.sin(i) * 60));
  const far = new SV.Robot('bear', 800 + 400, 800);
  g.robots.push(...near, far);
  dog.add_xp(100);
  dog.add_xp(350);
  assert.equal(dog.trigger_super(g), true);
  near.forEach((r) => assert.equal(r.stun, 4));
  assert.equal(far.stun, 0);
  assert.equal(g.player.shield, 2);
});
test('energiskölden tar två träffar innan Signe skadas', () => {
  const g = makeGame();
  g.player.apply_energy_shield(2);
  const e0 = g.player.energy;
  g.player.hurt(2, g, {});
  g.player.invuln = 0;
  g.player.hurt(2, g, {});
  g.player.invuln = 0;
  assert.equal(g.player.energy, e0);
  g.player.hurt(2, g, {});
  assert.equal(g.player.energy, e0 - 2);
});

console.log('Tidsstormen (GDD §5.2 EnvironmentController)');
test('storm_intensity klampas till 0–1', () => {
  const env = new SV.EnvironmentController();
  env.storm_intensity = 1.7;
  assert.equal(env.storm_intensity, 1);
  env.storm_intensity = -3;
  assert.equal(env.storm_intensity, 0);
});
test('ljuset dämpas och partiklarna ökar med stormen, utan klocka', () => {
  const env = new SV.EnvironmentController();
  env.storm_intensity = 1;
  for (let i = 0; i < 200; i++) env.update(0.1, { x: 0, y: 0 });
  assert.ok(env.visual > 0.99);
  assert.ok(env.light.energy < 0.7);
  assert.ok(env.particle.amount_ratio > 0.99);
  assert.ok(Math.abs(env.particle.speed_scale - 2.5) < 0.05);
});

console.log('Rustning och strid');
test('rustningsstilar klassas enligt GDD-tabellen', () => {
  const c = (h, ch, l) => SV.ArmorStyle.classify({ helmet: h, chest: ch, legs: l }).id;
  assert.equal(c('#4a6b3a', '#6b5a3a', '#3b4d2e'), 'camo');
  assert.equal(c('#39ff9a', '#ff3df0', '#3dd8ff'), 'neon');
  assert.equal(c('#3a3d44', '#2b2d33', '#45474f'), 'graphite');
  assert.equal(c('#2f8a5a', '#4fc27a', '#3a4a6a'), 'balanced');
});
test('grafit halverar elektrisk skada', () => {
  const g = makeGame();
  g.player.setArmor({ helmet: '#3a3d44', chest: '#2b2d33', legs: '#45474f' });
  const e0 = g.player.energy;
  g.player.hurt(2, g, {});
  assert.equal(g.player.energy, e0 - 1);
});
test('frusen robot tar 50 % mer skada av elhugg', () => {
  const g = makeGame();
  const a = new SV.Robot('bear', 0, 0), b = new SV.Robot('bear', 0, 0);
  b.frozen = 2;
  a.takeDamage(10, 'shock', g);
  b.takeDamage(10, 'shock', g);
  assert.equal(a.maxHp - a.hp, 10);
  assert.equal(b.maxHp - b.hp, 15);
});

console.log('Världen');
const w = new SV.World();
test('världen är deterministisk (samma seed ger samma karta)', () => {
  const w2 = new SV.World();
  assert.deepEqual(Array.from(w2.ground), Array.from(w.ground));
});
test('minst åtta kristaller och Urkärnan nås utan specialförmågor', () => {
  const seen = new Uint8Array(w.W * w.H);
  const st = [[Math.floor(w.spawn.x / 16), Math.floor(w.spawn.y / 16)]];
  seen[st[0][1] * w.W + st[0][0]] = 1;
  while (st.length) {
    const [x, y] = st.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!w.inBounds(nx, ny) || seen[ny * w.W + nx] || w.isSolidTile(nx, ny)) continue;
      seen[ny * w.W + nx] = 1;
      st.push([nx, ny]);
    }
  }
  const reach = w.crystals.filter((c) => seen[c.ty * w.W + c.tx]).length;
  assert.ok(reach >= 8, 'nåbara kristaller: ' + reach);
  assert.ok(seen[10 * w.W + 48] || seen[11 * w.W + 48], 'Urkärnan');
  w.animals.forEach((a) => assert.ok(seen[Math.floor(a.y / 16) * w.W + Math.floor(a.x / 16)], a.kind));
});
test('varje kristallgrotta har golv av grottyp runt kristallen', () => {
  assert.equal(w.grottos.length, 6);
  w.grottos.forEach((g) => assert.equal(w.g(g.x, g.y), SV.G.CAVE));
});
test('Bävern bygger bro och stockar kan röjas (sparas som ändringar)', () => {
  const w3 = new SV.World();
  assert.equal(w3.buildBridge('lake'), true);
  w3.clearBlock(74, 22);
  assert.equal(w3.changes.map((c) => c.t).join(','), 'bridge,clear');
  const w4 = new SV.World();
  w4.applyChanges(w3.changes);
  assert.equal(w4.bridgeSites.lake.built, true);
  assert.equal(w4.b(74, 22), SV.B.NONE);
});

console.log(`\n${passed} tester gick igenom${process.exitCode ? ', men några misslyckades' : ''}.`);
