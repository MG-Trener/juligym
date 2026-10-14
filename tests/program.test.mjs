import test from 'node:test';
import assert from 'node:assert/strict';
import { access, stat } from 'node:fs/promises';
import { days, exercises, totalSets } from '../exercises.js';

test('Три полных дня без дублирования движения внутри занятия', () => {
  assert.equal(days.length, 3);
  for (const day of days) {
    assert.equal(day.items.length, 5);
    assert.equal(new Set(day.items).size, 5);
    day.items.forEach(id => assert.ok(exercises[id], `Неизвестное упражнение ${id}`));
    assert.equal(totalSets(day, 'easy'), 5);
    assert.equal(totalSets(day, 'regular'), 10);
  }
  assert.deepEqual(new Set(days.flatMap(d => d.items)), new Set(Object.keys(exercises)));
});

test('У каждого движения есть три фазы, дозировка, облегчение и локальная иллюстрация', async () => {
  for (const [id, e] of Object.entries(exercises)) {
    assert.equal(e.phases.length, 3, id);
    assert.equal(e.steps.length, 3, id);
    assert.ok(e.cue && e.easier && e.avoid && e.muscles, id);
    assert.match(e.reps, /^\d+–\d+$/);
    assert.match(e.easy, /^\d+–\d+$/);
    assert.ok(e.rest >= 45 && e.rest <= 90);
    const file = new URL(`../assets/exercises/${id}.webp`, import.meta.url);
    await access(file);
    assert.ok((await stat(file)).size > 10000, `Пустое изображение: ${id}`);
  }
});
