import { joinMarkdownSections, readClientMarkdownSource, readSharedMarkdownParts } from './shared.mjs';

export function renderOpencodeNativeOutputs({ rootDir }) {
  return {
    operations: [
      {
        kind: 'managed-file',
        targetPath: '.opencode/AIOS.md',
        content: joinMarkdownSections([
          ...readSharedMarkdownParts(rootDir),
          readClientMarkdownSource(rootDir, 'opencode', 'AIOS.md'),
        ]),
      },
    ],
    managedTargets: ['.opencode/AIOS.md', '.opencode/skills'],
  };
}
