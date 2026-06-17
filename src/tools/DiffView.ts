import chalk from 'chalk';

export function generateDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const lines: string[] = [];
  lines.push(chalk.bold(`--- ${filePath}`));
  lines.push(chalk.bold(`+++ ${filePath}`));

  const maxContext = 3;
  const changes = findChanges(oldLines, newLines);

  if (changes.length === 0) {
    return chalk.gray('(no changes)');
  }

  for (const change of changes) {
    const startOld = Math.max(0, change.oldStart - maxContext);
    const endOld = Math.min(oldLines.length, change.oldEnd + maxContext);
    const startNew = Math.max(0, change.newStart - maxContext);
    const endNew = Math.min(newLines.length, change.newEnd + maxContext);

    lines.push(chalk.cyan(`@@ -${startOld + 1},${endOld - startOld} +${startNew + 1},${endNew - startNew} @@`));

    for (let i = startOld; i < change.oldStart; i++) {
      lines.push(chalk.gray(` ${oldLines[i] ?? ''}`));
    }

    for (let i = change.oldStart; i < change.oldEnd; i++) {
      lines.push(chalk.red(`-${oldLines[i] ?? ''}`));
    }

    for (let i = change.newStart; i < change.newEnd; i++) {
      lines.push(chalk.green(`+${newLines[i] ?? ''}`));
    }

    for (let i = change.oldEnd; i < endOld; i++) {
      lines.push(chalk.gray(` ${oldLines[i] ?? ''}`));
    }
  }

  return lines.join('\n');
}

interface Change {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

function findChanges(oldLines: string[], newLines: string[]): Change[] {
  const changes: Change[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++;
      j++;
      continue;
    }

    const changeStart = { old: i, new: j };

    // find next matching line
    let foundMatch = false;
    for (let lookAhead = 1; lookAhead <= 10; lookAhead++) {
      // check if old line matches a future new line
      if (i + lookAhead < oldLines.length && j < newLines.length) {
        const matchIdx = newLines.indexOf(oldLines[i + lookAhead]!, j);
        if (matchIdx !== -1 && matchIdx - j <= lookAhead + 2) {
          changes.push({
            oldStart: changeStart.old,
            oldEnd: i + lookAhead,
            newStart: changeStart.new,
            newEnd: matchIdx,
          });
          i = i + lookAhead;
          j = matchIdx;
          foundMatch = true;
          break;
        }
      }
    }

    if (!foundMatch) {
      // consume remaining as one big change
      changes.push({
        oldStart: changeStart.old,
        oldEnd: oldLines.length,
        newStart: changeStart.new,
        newEnd: newLines.length,
      });
      break;
    }
  }

  return changes;
}
