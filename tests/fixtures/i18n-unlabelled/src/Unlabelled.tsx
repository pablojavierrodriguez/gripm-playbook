const Trash = () => null;
const Icon = () => null;

/**
 * The other half of the sensitivity guard: teaching the detector that
 * `{t('key')}` is a label must not teach it that ANY expression is.
 *
 * Every control below genuinely has no accessible name, so every one of them
 * must still be reported. Line 24 is the naive implementation this fixture
 * exists to forbid — `{cond && <span>texto</span>}` read as text would be the
 * string "cond &&", which would silence the finding.
 */

/** A plain icon-only control: nothing about i18n, still unnamed. */
export const UnlabelledIconButton = () => (
  <button type="button" className="p-1" onClick={remove}>
    <Trash />
  </button>
);

/** A logical expression is code, not a name. */
export const ConditionalExpression = () => (
  <button type="button" onClick={remove}>
    <Icon />
    {cond && 'texto'}
  </button>
);

/** Nor does a guarded subtree guarantee that the control is ever named. */
export const ConditionalSubtree = () => (
  <button type="button" onClick={remove}>
    <Icon />
    {cond && <span>texto</span>}
  </button>
);