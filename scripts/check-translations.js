#!/usr/bin/env node
/**
 * scripts/check-translations.js
 * Verifies all 4 translation dictionaries have the same keys.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const file = resolve('src/data/translations.js');
const src = readFileSync(file, 'utf8');

function extractKeys(name) {
  // Find the object by looking for the assignment pattern
  const startIdx = src.indexOf(`const ${name} = {`);
  if (startIdx === -1) return [];

  // Find matching closing brace
  let depth = 0;
  let endIdx = startIdx;
  const blockStart = src.indexOf('{', startIdx);
  for (let i = blockStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') depth--;
    if (depth === 0) { endIdx = i; break; }
  }

  const block = src.slice(startIdx, endIdx + 1);

  // Extract quoted keys (only top-level, not nested objects)
  const keys = [];
  const keyRegex = /^\s*['"]([^'"]+)['"]\s*:/gm;
  let m;
  while ((m = keyRegex.exec(block)) !== null) {
    keys.push(m[1]);
  }
  return [...new Set(keys)];
}

const ht = extractKeys('trans_ht');
const en = extractKeys('trans_en');
const es = extractKeys('trans_es');
const fr = extractKeys('trans_fr');

console.log(`\n📊 Key count: ht=${ht.length}, en=${en.length}, es=${es.length}, fr=${fr.length}`);

// Find missing keys in each language
const allKeys = new Set([...ht, ...en, ...es, ...fr]);
let missingCount = 0;
const missingKeys = [];

for (const key of [...allKeys].sort()) {
  const missingIn = [];
  if (!ht.includes(key)) missingIn.push('ht');
  if (!en.includes(key)) missingIn.push('en');
  if (!es.includes(key)) missingIn.push('es');
  if (!fr.includes(key)) missingIn.push('fr');
  if (missingIn.length > 0) {
    missingCount++;
    missingKeys.push({ key, missingIn });
  }
}

if (missingCount === 0) {
  console.log('\n✅ Tout kle yo egal nan tout 4 lang yo!');
} else {
  console.log(`\n⚠️  ${missingCount} kle ki manke:`);
  for (const { key, missingIn } of missingKeys) {
    console.log(`  ❌ "${key}" → manke nan: ${missingIn.join(', ')}`);
  }
}

// Check for empty values
let emptyCount = 0;
for (const [name, dict] of [['ht', ht], ['en', en], ['es', es], ['fr', fr]]) {
  for (const key of dict) {
    // Extract the value for this key — match '' or "" (same-quote pairs only)
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyPattern = new RegExp(`(?:['"]${escaped}['"]\\s*:\\s*''|[\"]${escaped}[\"]\\s*:\\s*\"\")`, 'm');
    if (keyPattern.test(src)) {
      if (emptyCount < 20) {
        console.log(`  ⚠️  Empty value: "${key}" in ${name}`);
      }
      emptyCount++;
    }
  }
}

if (emptyCount > 0) {
  console.log(`\n⚠️  ${emptyCount} valè vid ki detekte.`);
} else {
  console.log('\n✅ Pa gen valè vid.');
}

console.log(`\n📈 Total kle: ${allKeys.size}`);
console.log(`   ht: ${ht.length} | en: ${en.length} | es: ${es.length} | fr: ${fr.length}`);
