// scripts/lib/tui-ink/components/Footer.tsx
import React from 'react';

import { Box, Text } from 'ink';

interface FooterProps {
  hints?: string[];
}

export function Footer({ hints = ['↑/↓ Navigate', 'Space Toggle', 'Enter Confirm', 'B Back', 'Q Quit'] }: FooterProps) {
  return (
    <Box marginTop={1}>
      <Text dimColor>
        {hints.join(' | ')}
      </Text>
    </Box>
  );
}