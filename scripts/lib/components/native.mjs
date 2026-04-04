function summarize(client = 'all') {
  return {
    ok: true,
    client,
    installed: 0,
    updated: 0,
    removed: 0,
    effectiveWarnings: 0,
  };
}

export async function installNativeEnhancements({
  client = 'all',
  io = console,
} = {}) {
  io.log(`[info] native enhancements scaffold active for client=${client}`);
  return summarize(client);
}

export async function updateNativeEnhancements({
  client = 'all',
  io = console,
} = {}) {
  io.log(`[info] native enhancements scaffold update active for client=${client}`);
  return summarize(client);
}

export async function uninstallNativeEnhancements({
  client = 'all',
  io = console,
} = {}) {
  io.log(`[info] native enhancements scaffold uninstall active for client=${client}`);
  return summarize(client);
}

export async function doctorNativeEnhancements({
  client = 'all',
  io = console,
} = {}) {
  io.log(`[info] native enhancements scaffold doctor active for client=${client}`);
  return summarize(client);
}
