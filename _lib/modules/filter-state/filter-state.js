function getDefault(cfg) {
  if (cfg.kind === 'set') return new Set();
  if (cfg.kind === 'enum') return cfg.default ?? cfg.values[0];
  if (cfg.kind === 'boolean') return false;
  return '';
}

function isDefaultValue(val, cfg) {
  if (cfg.kind === 'set') return val.size === 0;
  return val === getDefault(cfg);
}

function parse(raw, cfg) {
  if (cfg.kind === 'set') return Array.isArray(raw) ? new Set(raw) : new Set();
  if (cfg.kind === 'enum') return cfg.values.includes(raw) ? raw : getDefault(cfg);
  if (cfg.kind === 'boolean') return typeof raw === 'boolean' ? raw : false;
  return typeof raw === 'string' ? raw : '';
}

function defaults(shape) {
  return Object.fromEntries(Object.entries(shape).map(([k, cfg]) => [k, getDefault(cfg)]));
}

function serialize(state, shape) {
  const obj = {};
  for (const [k, cfg] of Object.entries(shape))
    obj[k] = cfg.kind === 'set' ? [...state[k]] : state[k];
  return obj;
}

// Persistence and validation helper for localStorage-backed filter state.
// shape: { fieldName: { kind: 'string'|'set'|'enum'|'boolean', values?: [...], default?: ... } }
// boolean fields are persisted but do not count toward isActive().
export function FilterState(storageKey, shape) {
  return {
    load() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return defaults(shape);
        const obj = JSON.parse(raw);
        return Object.fromEntries(Object.entries(shape).map(([k, cfg]) => [k, parse(obj[k], cfg)]));
      } catch {
        return defaults(shape);
      }
    },

    save(state) {
      const allDefault = Object.entries(shape).every(([k, cfg]) => isDefaultValue(state[k], cfg));
      if (allDefault) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(serialize(state, shape)));
    },

    clear() {
      localStorage.removeItem(storageKey);
    },

    isActive(state) {
      return Object.entries(shape).some(([k, cfg]) =>
        cfg.kind !== 'boolean' && !isDefaultValue(state[k], cfg)
      );
    },
  };
}
