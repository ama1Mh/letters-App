import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';

export default function DraftsScreen() {
  const { t } = useTranslation();
  return (
    <EmptyState
      testID="drafts-screen"
      title={t('drafts.emptyTitle')}
      body={t('drafts.emptyBody')}
    />
  );
}
