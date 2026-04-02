// scripts/lib/tui-ink/components/Checkbox.tsx

import { Box, Text } from 'ink';

interface CheckboxProps {
  label: string;
  checked: boolean;
  active: boolean;
  description?: string;
}

export function Checkbox({ label, checked, active, description }: CheckboxProps) {
  const prefix = active ? '▸ ' : '  ';
  const mark = checked ? '[x]' : '[ ]';
  const labelColor = active ? 'cyan' : undefined;
  const labelBold = active;

  return (
    <Box flexDirection="column">
      <Text color={labelColor} bold={labelBold}>
        {prefix}{mark} {label}
      </Text>
      {description && active && (
        <Text dimColor>
          {'      '}{description}
        </Text>
      )}
    </Box>
  );
}