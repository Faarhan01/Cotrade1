import { AccountInfo, DetailedSymbolInfo, EASyncPayload, PendingOrder, Position, TickData } from '@core/types';
import { tradeStore } from '@services/tradeStore';
import { broadcast } from '@services/websocketServer';

export interface DirectMT5Snapshot {
  account: AccountInfo | null;
  positions: Position[];
  pendingOrders: PendingOrder[];
  ticks: TickData[];
  symbols: DetailedSymbolInfo[];
}

function publishSnapshot(source: 'package' | 'ea') {
  const state = tradeStore.getState();
  const connected = state.account.login > 0;
  const syncedAt = Date.now();

  broadcast({
    type: source === 'ea' ? 'ea:sync' : 'mt5:sync',
    payload: {
      account: state.account,
      positions: state.positions,
      pendingOrders: state.pendingOrders,
      ticks: state.ticks,
      allSymbols: state.allSymbols,
      currentChart: state.currentChart,
      chartHistory: state.chartHistory,
      tickHistory: state.tickHistory,
      connection: state.connection,
      terminalConnected: connected,
      isEaConnected: source === 'ea' && connected,
      lastSync: syncedAt,
      lastEaSync: source === 'ea' ? syncedAt : 0,
      source,
    },
  });
}

export function ingestPackageSnapshot(snapshot: DirectMT5Snapshot): void {
  tradeStore.handleDirectSync(snapshot);
  publishSnapshot('package');
}

export async function ingestEASnapshot(payload: EASyncPayload): Promise<ReturnType<typeof tradeStore.handleEASync>> {
  const commands = await tradeStore.handleEASync(payload);
  publishSnapshot('ea');
  return commands;
}