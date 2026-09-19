import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';

export default function SentScreen() {
  const { t } = useTranslation();
  return (
    <EmptyState testID="sent-screen" title={t('sent.emptyTitle')} body={t('sent.emptyBody')} />
  );
}
