import fs from 'fs';

const content = fs.readFileSync('src/components/Comparator.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('border') || line.includes('<table') || line.includes('<td') || line.includes('<th')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
