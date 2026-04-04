import { joinMarkdownSections, readClientMarkdownSource, readSharedMarkdownParts } from './shared.mjs';

export function renderGeminiNativeOutputs({ rootDir }) {
  return {
    operations: [
      {
        kind: 'managed-file',
        targetPath: '.gemini/AIOS.md',
        content: joinMarkdownSections([
          ...readSharedMarkdownParts(rootDir),
          readClientMarkdownSource(rootDir, 'gemini', 'AIOS.md'),
        ]),
      },
    ],
    managedTargets: ['.gemini/AIOS.md', '.gemini/skills'],
  };
}
