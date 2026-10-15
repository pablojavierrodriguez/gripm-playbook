import { useTranslation } from 'react-i18next';

const Plus = () => null;
const Search = () => null;

/**
 * An internationalized control names itself with an expression, never with
 * literal text. Before the fix `stripExpressions` erased every `{...}` in the
 * child list, so all of these looked icon-only and UX-010 reported them: an
 * app that ships translations could not pass the rule by construction.
 *
 * Nothing here may be reported.
 */
export const NewItemButton = () => {
  const { t } = useTranslation();

  return (
    <button type="button" className="p-1" onClick={create}>
      <Plus />
      <span>{t('header.newItem')}</span>
    </button>
  );
};

/** The same control with the label as a direct expression child. */
export const DirectExpressionLabel = () => {
  const { t } = useTranslation();

  return (
    <button type="button" onClick={create}>
      <Plus />
      {t('header.newItem')}
    </button>
  );
};

/** A key holding a question mark must still be a label. */
export const QuotedKeyWithPunctuation = () => {
  const { t } = useTranslation();

  return (
    <button type="button" onClick={create}>
      <Plus />
      <span>{t('header.newItem?')}</span>
    </button>
  );
};

/** Interpolated label: still a single template literal, still a name. */
export const InterpolatedLabel = () => {
  const { t, i18n } = useTranslation();

  return (
    <button type="button" onClick={create}>
      <Search />
      <span>{`${i18n.t('results.count')} ${count}`}</span>
    </button>
  );
};