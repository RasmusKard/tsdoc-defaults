import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameSyntax } from '../src/compare.js';

void test('formatting does not count', () => {
  for (const [a, b] of [
    ['const x = { a: [1, 2] };', 'const x={a:[1,2,],}  // c'],
    ["const x = 'a';", 'const x = "a"'],
    ["const x = { 'k': 1, 2: 0 };", "const x = { k: 1, '2': 0 };"],
    ['const x = (1);', 'const x = 1;'],
    ['const x = a && b || c;', 'const x = (a && b) || c;'],
    ['const f = (x) => x;', 'const f = x => x;'],
    ['const x = 0x10;', 'const x = 16;'],
    ['type T = Required<Pick<O, "a">>;', "type T = Required<Pick<O, ('a')>>"],
    ['const x = `a${ b }c`;', 'const x = `a${b}c`;'],
  ])
    assert.ok(sameSyntax(a, b), `${a} vs ${b}`);
});

void test('code changes count', () => {
  for (const [a, b] of [
    ["const x = 'a,]';", "const x = 'a]';"],
    ["const x = '(x) =>';", "const x = 'x =>';"],
    ['const x = -1;', 'const x = +1;'],
    ['const x = 1;', 'let x = 1;'],
    ['const x = (a + b) * c;', 'const x = a + b * c;'],
    ['const x = (a?.b).c;', 'const x = a?.b.c;'],
    ['const x = { k: 1 };', 'const x = { [k]: 1 };'],
    ["const x = 'k';", 'const x = k;'],
    ['import type { A } from "a";', 'import { A } from "a";'],
    ['const x = `a`;', 'const x = `b`;'],
    ['const x = 1;', 'const x = 1; const y = 2;'],
    ['const x = 1;', 'const x = ;'],
  ])
    assert.ok(!sameSyntax(a, b), `${a} vs ${b}`);
});
