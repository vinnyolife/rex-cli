// scripts/lib/tui-ink/tests/tui-ink.test.ts

import assert from 'node:assert/strict';
import test from 'node:test';

// Note: Full Ink component tests require special terminal handling.
// These tests verify the modules can be imported correctly.

test('useSetupOptions hook can be imported', async () => {
  const mod = await import('../hooks/useSetupOptions.ts');
  assert.ok(mod.useSetupOptions, 'useSetupOptions should be exported');
  assert.equal(typeof mod.useSetupOptions, 'function', 'useSetupOptions should be a function');
});

test('components can be imported', async () => {
  const header = await import('../components/Header.tsx');
  const footer = await import('../components/Footer.tsx');
  const checkbox = await import('../components/Checkbox.tsx');
  const scrollable = await import('../components/ScrollableSelect.tsx');

  assert.ok(header.Header, 'Header component should be exported');
  assert.ok(footer.Footer, 'Footer component should be exported');
  assert.ok(checkbox.Checkbox, 'Checkbox component should be exported');
  assert.ok(scrollable.ScrollableSelect, 'ScrollableSelect component should be exported');
});

test('screens can be imported', async () => {
  const main = await import('../screens/MainScreen.tsx');
  const setup = await import('../screens/SetupScreen.tsx');
  const update = await import('../screens/UpdateScreen.tsx');
  const uninstall = await import('../screens/UninstallScreen.tsx');
  const doctor = await import('../screens/DoctorScreen.tsx');
  const skills = await import('../screens/SkillPickerScreen.tsx');
  const confirm = await import('../screens/ConfirmScreen.tsx');

  assert.ok(main.MainScreen, 'MainScreen should be exported');
  assert.ok(setup.SetupScreen, 'SetupScreen should be exported');
  assert.ok(update.UpdateScreen, 'UpdateScreen should be exported');
  assert.ok(uninstall.UninstallScreen, 'UninstallScreen should be exported');
  assert.ok(doctor.DoctorScreen, 'DoctorScreen should be exported');
  assert.ok(skills.SkillPickerScreen, 'SkillPickerScreen should be exported');
  assert.ok(confirm.ConfirmScreen, 'ConfirmScreen should be exported');
});

test('App and runInteractiveSession can be imported', async () => {
  const app = await import('../App.tsx');
  const index = await import('../index.tsx');

  assert.ok(app.App, 'App component should be exported');
  assert.ok(index.runInteractiveSession, 'runInteractiveSession should be exported');
  assert.equal(typeof index.runInteractiveSession, 'function', 'runInteractiveSession should be a function');
});