import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';

const TEST_FILE = '/Users/zws/Documents/mdTest/mdTable_868k.md';

describe('mdast parse speed', () => {
  it('parses mdTable_868k.md with fromMarkdown', () => {
    const source = readFileSync(TEST_FILE, 'utf-8');
    const bytes = Buffer.byteLength(source, 'utf-8');

    // warm up (JIT / module init)
    fromMarkdown(source);

    const runs = 5;
    const durations: number[] = [];
    let nodeCount = 0;

    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      const tree = fromMarkdown(source);
      const end = performance.now();
      durations.push(end - start);
      if (i === 0) {
        nodeCount = countNodes(tree);
      }
    }

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const mbPerSec = bytes / 1024 / 1024 / (avg / 1000);

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '===== mdast (mdast-util-from-markdown) parse speed =====',
        `file        : ${TEST_FILE}`,
        `size        : ${(bytes / 1024).toFixed(1)} KB (${bytes} bytes)`,
        `runs        : ${runs}`,
        `node count  : ${nodeCount}`,
        `durations   : ${durations.map((d) => d.toFixed(2)).join(', ')} ms`,
        `avg         : ${avg.toFixed(2)} ms`,
        `min / max   : ${min.toFixed(2)} / ${max.toFixed(2)} ms`,
        `throughput  : ${mbPerSec.toFixed(2)} MB/s`,
        '=======================================================',
        '',
      ].join('\n'),
    );

    expect(nodeCount).toBeGreaterThan(0);
  }, 60_000);

  it('computes average paragraph length from the ast', () => {
    const source = readFileSync(TEST_FILE, 'utf-8');
    const tree = fromMarkdown(source);

    const runs = 5;
    const durations: number[] = [];
    let paragraphCount = 0;
    let totalLength = 0;

    for (let i = 0; i < runs; i++) {
      const lengths: number[] = [];
      const start = performance.now();
      collectParagraphLengths(tree, lengths);
      const sum = lengths.reduce((a, b) => a + b, 0);
      const end = performance.now();
      durations.push(end - start);
      if (i === 0) {
        paragraphCount = lengths.length;
        totalLength = sum;
      }
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const avgLength = paragraphCount > 0 ? totalLength / paragraphCount : 0;

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '===== mdast average paragraph length =====',
        `runs            : ${runs}`,
        `paragraph count : ${paragraphCount}`,
        `total length    : ${totalLength} chars`,
        `avg length      : ${avgLength.toFixed(2)} chars/paragraph`,
        `durations       : ${durations.map((d) => d.toFixed(3)).join(', ')} ms`,
        `avg duration    : ${avgDuration.toFixed(3)} ms`,
        `min / max       : ${minDuration.toFixed(3)} / ${maxDuration.toFixed(3)} ms`,
        '==========================================',
        '',
      ].join('\n'),
    );

    expect(paragraphCount).toBeGreaterThan(0);
  }, 60_000);
});

function collectParagraphLengths(node: unknown, out: number[]): void {
  if (!node || typeof node !== 'object') return;
  const typed = node as { type?: string; children?: unknown[] };
  if (typed.type === 'paragraph') {
    out.push(toString(node as never).length);
    return;
  }
  if (Array.isArray(typed.children)) {
    for (const child of typed.children) {
      collectParagraphLengths(child, out);
    }
  }
}

function countNodes(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  let count = 1;
  const children = (node as { children?: unknown[] }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      count += countNodes(child);
    }
  }
  return count;
}
