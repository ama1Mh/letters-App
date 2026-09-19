import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';

export default function InboxScreen() {
  const { t } = useTranslation();
  return (
    <EmptyState testID="inbox-screen" title={t('inbox.emptyTitle')} body={t('inbox.emptyBody')} />
  );
}
