import {
  joinMarkdownSections,
  readClientJsonSource,
  readClientMarkdownSource,
  readSharedMarkdownParts,
} from './shared.mjs';

export function renderClaudeNativeOutputs({ rootDir }) {
  return {
    operations: [
      {
        kind: 'markdown-block',
        targetPath: 'CLAUDE.md',
        content: joinMarkdownSections([
          ...readSharedMarkdownParts(rootDir),
          readClientMarkdownSource(rootDir, 'claude', 'CLAUDE.md'),
        ]),
      },
      {
        kind: 'json-merge',
        targetPath: '.claude/settings.local.json',
        content: readClientJsonSource(rootDir, 'claude', 'settings.local.json'),
      },
    ],
    managedTargets: ['CLAUDE.md', '.claude/settings.local.json', '.claude/agents', '.claude/skills'],
  };
}
