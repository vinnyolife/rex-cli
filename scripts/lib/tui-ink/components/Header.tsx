// scripts/lib/tui-ink/components/Header.tsx

import { Box, Text } from 'ink';

interface HeaderProps {
  rootDir: string;
}

export function Header({ rootDir }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        AIOS — Unified Entry (Ink TUI)
      </Text>
      <Text dimColor>
        Repo: {rootDir}
      </Text>
    </Box>
  );
}