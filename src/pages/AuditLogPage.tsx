import React from 'react';
import { AppState } from '@/types';
import { AuditLogViewer } from '../components/history/AuditLogViewer';

interface AuditLogPageProps {
  state: AppState | null;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ state }) => {
  return (
    <div className="container mx-auto px-4 space-y-6">
      <AuditLogViewer logs={state?.logs || []} />
    </div>
  );
};

