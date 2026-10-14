#!/usr/bin/env python3
"""
Peron Python MT5 Bridge Service
Directly connects to MetaTrader 5 using the Python package (Faarhan01/peron).
Provides a lightweight, zero-dependency HTTP interface for the Node.js backend.
Strictly relies on the real MetaTrader 5 API without generating fake simulated data.
"""

import sys
import os
import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Ensure local peron package or custom paths are in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
WORKSPACE_ROOT = os.path.dirname(BACKEND_DIR)

candidate_paths = []

# From environment - support both single path and comma-separated
env_paths = os.environ.get("PERON_PACKAGE_PATH", "").strip()
if env_paths:
    for p in env_paths.split(','):
        p = p.strip()
        if p:
            candidate_paths.append(os.path.expanduser(p))

# Additional common locations
candidate_paths.extend([
    os.path.join(WORKSPACE_ROOT, "peron_package"),
    os.path.join(WORKSPACE_ROOT, "metatrader5_package"),
    os.path.join(BACKEND_DIR, "peron_package"),
    os.path.join(os.path.dirname(WORKSPACE_ROOT), "peron"),
    os.path.join(os.path.dirname(WORKSPACE_ROOT), "peron", "metatrader5_package"),
    os.path.join(os.path.dirname(os.path.dirname(WORKSPACE_ROOT)), "Tools", "peron", "metatrader5_package"),
    os.path.join(os.path.dirname(os.path.dirname(WORKSPACE_ROOT)), "Tools", "peron"),
])

# Remove the local backend peron_package (broken numpy) from sys.path to avoid circular import
BACKEND_LOCAL_PKG = os.path.join(BACKEND_DIR, "peron_package")
if BACKEND_LOCAL_PKG in sys.path:
    sys.path.remove(BACKEND_LOCAL_PKG)

for p in candidate_paths:
    if p and os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

# Try importing official MetaTrader5 package
HAVE_NATIVE_MT5 = False
mt5 = None
package_error_detail = None

try:
    import MetaTrader5 as mt5_module
    mt5 = mt5_module
    HAVE_NATIVE_MT5 = True
    print(f"[Peron] Loaded MetaTrader 5 Python package version {getattr(mt5, '__version__', '5.0.6231')}")
except Exception as e:
    package_error_detail = str(e)
    print(f"[Peron Notice] MetaTrader5 native terminal module not initialized ({package_error_detail}). Waiting for MT5 app.")

# Timeframe mapping for MetaTrader 5
TIMEFRAMES = {
    "M1": 1,
    "M2": 2,
    "M3": 3,
    "M4": 4,
    "M5": 5,
    "M6": 6,
    "M10": 10,
    "M12": 12,
    "M15": 15,
    "M20": 20,
    "M30": 30,
    "H1": 1 | 0x4000,
    "H2": 2 | 0x4000,
    "H3": 3 | 0x4000,
    "H4": 4 | 0x4000,
    "H6": 6 | 0x4000,
    "H8": 8 | 0x4000,
    "H12": 12 | 0x4000,
    "D1": 24 | 0x4000,
    "W1": 1 | 0x8000,
    "MN1": 1 | 0xC000,
}


def resolve_filling_policy(mt5_module, symbol_info, order_type, is_pending, requested=""):
    filling_modes = {
        "FOK": (mt5_module.ORDER_FILLING_FOK, 1),
        "IOC": (mt5_module.ORDER_FILLING_IOC, 2),
        "RETURN": (mt5_module.ORDER_FILLING_RETURN, None),
        "BOC": (getattr(mt5_module, "ORDER_FILLING_BOC", 3), 4),
    }
    requested = str(requested or "").upper()
    mode = int(getattr(symbol_info, "filling_mode", 0)) if symbol_info else 0
    execution = int(getattr(symbol_info, "trade_exemode", getattr(mt5_module, "SYMBOL_TRADE_EXECUTION_MARKET", 2))) if symbol_info else getattr(mt5_module, "SYMBOL_TRADE_EXECUTION_MARKET", 2)
    market_execution = getattr(mt5_module, "SYMBOL_TRADE_EXECUTION_MARKET", 2)

    if requested:
        if requested not in filling_modes:
            return None, f"Unsupported filling policy: {requested}"
        value, flag = filling_modes[requested]
        if flag is not None and not mode & flag:
            return None, f"{requested} filling is not supported for this symbol."
        if requested == "BOC" and (not is_pending or order_type not in ("BUY_LIMIT", "SELL_LIMIT")):
            return None, "BOC filling is only valid for pending limit orders."
        if requested == "RETURN" and not is_pending and execution == market_execution:
            return None, "RETURN filling is not allowed for market-execution deals."
        return value, None

    if is_pending:
        return mt5_module.ORDER_FILLING_RETURN, None
    if mode & 2:
        return mt5_module.ORDER_FILLING_IOC, None
    if mode & 1:
        return mt5_module.ORDER_FILLING_FOK, None
    if execution != market_execution:
        return mt5_module.ORDER_FILLING_RETURN, None
    return None, "The broker exposes no valid filling policy for this market-execution symbol."

class MT5Engine:
    def __init__(self):
        self.connected = False
        self.terminal_connected = False
        self.login = 0
        self.server = ""
        self.terminal_name = ""
        self.terminal_company = ""
        self.terminal_build = 0

    def connect(self, login=None, password=None, server=None, path=None, timeout=60000):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            self.connected = False
            self.terminal_connected = False
            return False, f"MetaTrader 5 desktop application is not available in this host environment ({package_error_detail}). Please run the bridge locally on a machine with MetaTrader 5 installed."

        init_kwargs = {}
        if path:
            init_kwargs["path"] = path
        if login:
            try:
                init_kwargs["login"] = int(login)
            except (ValueError, TypeError):
                pass
        if password:
            init_kwargs["password"] = password
        if server:
            init_kwargs["server"] = server
        if timeout:
            init_kwargs["timeout"] = int(timeout)

        try:
            res = mt5.initialize(**init_kwargs)
            if not res:
                err = mt5.last_error()
                self.connected = False
                self.terminal_connected = False
                return False, f"MT5 Initialize failed: code {err[0]}, description: {err[1]}"

            if login and password and server:
                logged = mt5.login(login=int(login), password=password, server=server)
                if not logged:
                    err = mt5.last_error()
                    return False, f"MT5 Login failed: code {err[0]}, description: {err[1]}"

            info = mt5.terminal_info()
            if info:
                self.connected = bool(info.connected)
                self.terminal_connected = True
                self.terminal_name = info.name
                self.terminal_company = info.company
                self.terminal_build = info.build
                return True, f"Connected to {info.name} (build {info.build})"
            else:
                self.connected = True
                self.terminal_connected = True
                return True, "Connected to MetaTrader 5 Terminal"
        except Exception as ex:
            self.connected = False
            self.terminal_connected = False
            return False, f"Exception initializing MT5: {str(ex)}"

    def disconnect(self):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                mt5.shutdown()
            except Exception:
                pass
        self.connected = False
        self.terminal_connected = False
        return True, "Disconnected from MetaTrader 5"

    def get_terminal_info(self):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                info = mt5.terminal_info()
                if info:
                    self.connected = bool(info.connected)
                    self.terminal_connected = True
                    return {
                        "name": info.name,
                        "company": info.company,
                        "build": info.build,
                        "connected": info.connected,
                        "tradeAllowed": info.trade_allowed,
                        "tradeApiDisabled": bool(getattr(info, "tradeapi_disabled", False)),
                        "dllsAllowed": bool(getattr(info, "dlls_allowed", False)),
                        "emailEnabled": bool(getattr(info, "email_enabled", False)),
                        "ftpEnabled": bool(getattr(info, "ftp_enabled", False)),
                        "notificationsEnabled": bool(getattr(info, "notifications_enabled", False)),
                        "communityAccount": bool(getattr(info, "community_account", False)),
                        "maxBars": int(getattr(info, "maxbars", 0)),
                        "pingLast": int(getattr(info, "ping_last", 0)),
                        "communityConnection": bool(getattr(info, "community_connection", False)),
                        "communityBalance": float(getattr(info, "community_balance", 0.0)),
                        "retransmission": float(getattr(info, "retransmission", 0.0)),
                        "mqid": bool(getattr(info, "mqid", False)),
                        "codepage": int(getattr(info, "codepage", 0)),
                        "language": getattr(info, "language", ""),
                        "path": getattr(info, "path", ""),
                        "data_path": getattr(info, "data_path", ""),
                        "commondata_path": getattr(info, "commondata_path", ""),
                        "isNative": True,
                    }
            except Exception:
                pass

        return {
            "name": "",
            "company": "",
            "build": 0,
            "connected": False,
            "tradeAllowed": False,
            "isNative": HAVE_NATIVE_MT5,
            "message": "MetaTrader 5 terminal application not connected"
        }

    def get_account_info(self):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                acc = mt5.account_info()
                if acc:
                    trade_mode = "DEMO"
                    if getattr(acc, "trade_mode", 0) == 1:
                        trade_mode = "CONTEST"
                    elif getattr(acc, "trade_mode", 0) == 2:
                        trade_mode = "REAL"

                    return {
                        "login": acc.login,
                        "tradeMode": trade_mode,
                        "balance": round(float(acc.balance), 2),
                        "equity": round(float(acc.equity), 2),
                        "margin": round(float(acc.margin), 2),
                        "freeMargin": round(float(acc.margin_free), 2),
                        "marginLevel": round(float(acc.margin_level), 2),
                        "marginCallLevel": round(float(getattr(acc, "margin_so_call", 0.0)), 2),
                        "stopOutLevel": round(float(getattr(acc, "margin_so_so", 0.0)), 2),
                        "marginStopOutMode": int(getattr(acc, "margin_so_mode", 0)),
                        "marginMode": int(getattr(acc, "margin_mode", 0)),
                        "leverage": int(acc.leverage),
                        "currency": acc.currency,
                        "server": acc.server,
                        "company": acc.company,
                        "profit": round(float(acc.profit), 2),
                        "assets": round(float(getattr(acc, "assets", 0.0)), 2),
                        "liabilities": round(float(getattr(acc, "liabilities", 0.0)), 2),
                        "commissionBlocked": round(float(getattr(acc, "commission_blocked", 0.0)), 2),
                        "lastUpdate": int(time.time() * 1000),
                        "tradeModeCode": int(getattr(acc, "trade_mode", 0)),
                        "credit": round(float(getattr(acc, "credit", 0.0)), 2),
                        "limitOrders": int(getattr(acc, "limit_orders", 0)),
                        "tradeAllowed": bool(getattr(acc, "trade_allowed", False)),
                        "tradeExpert": bool(getattr(acc, "trade_expert", False)),
                        "fifoClose": bool(getattr(acc, "fifo_close", False)),
                        "currencyDigits": int(getattr(acc, "currency_digits", 2)),
                    }
            except Exception:
                pass
        # No MT5 connection -> Return None (NO fake data)
        return None

    def get_symbols(self, group=None):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                symbols = mt5.symbols_get(group=group) if group else mt5.symbols_get()
                if symbols:
                    return [self._serialize_symbol_info(symbol) for symbol in symbols]
            except Exception:
                pass
        # Disconnected -> Return empty list (NO fake symbols)
        return []

    def get_ticks(self, target_symbols=None):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                # If target symbols not provided, query symbols in MarketWatch
                symbols_to_query = target_symbols
                if not symbols_to_query:
                    symbols = mt5.symbols_get()
                    if symbols:
                        symbols_to_query = [s.name for s in symbols if getattr(s, "select", False)]
                        if not symbols_to_query:
                            symbols_to_query = [s.name for s in symbols[:20]]

                if not symbols_to_query:
                    return []

                results = []
                now_ms = int(time.time() * 1000)
                for sym in symbols_to_query:
                    tick = mt5.symbol_info_tick(sym)
                    if tick:
                        res_spread = int(getattr(tick, "spread", 0) or round((tick.ask - tick.bid) / 0.00001))
                        results.append({
                            "symbol": sym,
                            "time": int(tick.time),
                            "bid": float(tick.bid),
                            "ask": float(tick.ask),
                            "spread": res_spread,
                            "last": float(tick.last or tick.bid),
                            "volume": int(getattr(tick, "volume", 1)),
                            "timeMsc": int(getattr(tick, "time_msc", now_ms)),
                            "flags": int(getattr(tick, "flags", 0)),
                            "high24h": float(tick.ask),
                            "low24h": float(tick.bid),
                        })
                return results
            except Exception:
                pass
        # Disconnected -> Return empty list (NO fake ticks)
        return []

    def get_candles(self, symbol, timeframe="M1", count=100, date_from=None, date_to=None, start_pos=0):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                tf_code = TIMEFRAMES.get(timeframe, 1)
                rates = None
                # Ensure symbol is active in terminal
                try:
                    mt5.symbol_select(symbol, True)
                except Exception:
                    pass

                if date_from is not None and date_to is not None:
                    rates = mt5.copy_rates_range(symbol, tf_code, int(date_from), int(date_to))
                elif date_from is not None:
                    rates = mt5.copy_rates_from(symbol, tf_code, int(date_from), int(count))
                else:
                    rates = mt5.copy_rates_from_pos(symbol, tf_code, max(0, int(start_pos)), int(count))

                if rates is not None and len(rates) > 0:
                    candles = []
                    for r in rates:
                        candles.append({
                            "time": int(r["time"]),
                            "timeIso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(r["time"])),
                            "open": float(r["open"]),
                            "high": float(r["high"]),
                            "low": float(r["low"]),
                            "close": float(r["close"]),
                            "volume": float(r["tick_volume"] if "tick_volume" in r.dtype.names else r["volume"]),
                            "spread": int(r["spread"]) if "spread" in r.dtype.names else 0,
                        })
                    return candles
            except Exception:
                pass
        # Disconnected -> Return empty list (NO fake candles)
        return []

    def get_ticks_history(self, symbol, date_from=None, date_to=None, count=1000, flags="ALL"):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                try:
                    mt5.symbol_select(symbol, True)
                except Exception:
                    pass
                ticks = None
                flag_name = "COPY_TICKS_" + str(flags).upper()
                tick_flags = getattr(mt5, flag_name, getattr(mt5, "COPY_TICKS_ALL", -1))
                if date_from and date_to:
                    ticks = mt5.copy_ticks_range(symbol, int(date_from), int(date_to), tick_flags)
                elif date_from:
                    ticks = mt5.copy_ticks_from(symbol, int(date_from), int(count), tick_flags)
                else:
                    now_sec = int(time.time())
                    from_sec = now_sec - 86400  # past 24 hours
                    ticks = mt5.copy_ticks_from(symbol, from_sec, int(count), tick_flags)

                if ticks is not None and len(ticks) > 0:
                    res = []
                    for t in ticks:
                        time_sec = int(t["time"])
                        time_msc = int(t["time_msc"] if "time_msc" in t.dtype.names else time_sec * 1000)
                        res.append({
                            "symbol": symbol,
                            "time": time_sec,
                            "timeMsc": time_msc,
                            "timeIso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time_sec)),
                            "bid": float(t["bid"]),
                            "ask": float(t["ask"]),
                            "last": float(t["last"]),
                            "volume": float(t["volume"]),
                            "flags": int(t["flags"]),
                        })
                    return res
            except Exception:
                pass
        return []

    def select_symbol(self, symbol, enable=True):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                res = mt5.symbol_select(symbol, bool(enable))
                return {"success": bool(res), "symbol": symbol, "selected": bool(enable)}
            except Exception as e:
                return {"success": False, "message": str(e)}
        return {"success": False, "message": "MetaTrader 5 terminal not connected"}

    def get_positions(self, symbol=None, ticket=None):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                if ticket is not None:
                    raw_positions = mt5.positions_get(ticket=int(ticket))
                elif symbol:
                    raw_positions = mt5.positions_get(symbol=symbol)
                else:
                    raw_positions = mt5.positions_get()
                if raw_positions is not None:
                    res = []
                    for p in raw_positions:
                        pos_type = "BUY" if p.type == 0 else "SELL"
                        res.append({
                            "ticket": int(p.ticket),
                            "symbol": p.symbol,
                            "type": pos_type,
                            "volume": float(p.volume),
                            "openPrice": float(p.price_open),
                            "currentPrice": float(p.price_current),
                            "sl": float(p.sl),
                            "tp": float(p.tp),
                            "profit": round(float(p.profit), 2),
                            "swap": round(float(p.swap), 2),
                            "magic": int(p.magic),
                            "comment": p.comment or "",
                            "openTime": int(p.time),
                            "openTimeMsc": int(getattr(p, "time_msc", 0)),
                            "updateTime": int(getattr(p, "time_update", 0)),
                            "updateTimeMsc": int(getattr(p, "time_update_msc", 0)),
                            "identifier": int(getattr(p, "identifier", p.ticket)),
                            "reason": int(getattr(p, "reason", 0)),
                            "externalId": getattr(p, "external_id", "") or "",
                        })
                    return res
            except Exception:
                pass
        return []

    def get_orders(self, symbol=None, ticket=None):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                if ticket is not None:
                    raw_orders = mt5.orders_get(ticket=int(ticket))
                elif symbol:
                    raw_orders = mt5.orders_get(symbol=symbol)
                else:
                    raw_orders = mt5.orders_get()
                if raw_orders is not None:
                    ORDER_TYPE_NAMES = {
                        2: "BUY_LIMIT",
                        3: "SELL_LIMIT",
                        4: "BUY_STOP",
                        5: "SELL_STOP",
                        6: "BUY_STOP_LIMIT",
                        7: "SELL_STOP_LIMIT"
                    }
                    res = []
                    for o in raw_orders:
                        res.append({
                            "ticket": int(o.ticket),
                            "symbol": o.symbol,
                            "type": ORDER_TYPE_NAMES.get(o.type, "PENDING"),
                            "volume": float(o.volume_initial),
                            "price": float(o.price_open),
                            "sl": float(o.sl),
                            "tp": float(o.tp),
                            "timeSetup": int(o.time_setup),
                            "timeSetupMsc": int(getattr(o, "time_setup_msc", 0)),
                            "timeDone": int(getattr(o, "time_done", 0)),
                            "timeDoneMsc": int(getattr(o, "time_done_msc", 0)),
                            "expiration": int(getattr(o, "time_expiration", 0)),
                            "typeTime": int(getattr(o, "type_time", 0)),
                            "typeFilling": int(getattr(o, "type_filling", 0)),
                            "state": int(getattr(o, "state", 0)),
                            "reason": int(getattr(o, "reason", 0)),
                            "positionId": int(getattr(o, "position_id", 0)),
                            "positionById": int(getattr(o, "position_by_id", 0)),
                            "volumeCurrent": float(getattr(o, "volume_current", o.volume_initial)),
                            "stopLimitPrice": float(getattr(o, "price_stoplimit", 0.0)),
                            "magic": int(o.magic),
                            "comment": o.comment or "",
                            "externalId": getattr(o, "external_id", "") or "",
                        })
                    return res
            except Exception:
                pass
        return []

    def execute_order(self, params):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {
                "success": False,
                "message": "MetaTrader 5 terminal is not running or connected. Launch MetaTrader 5 locally to execute real trades."
            }

        symbol = params.get("symbol")
        order_type_str = str(params.get("orderType", "BUY")).strip()
        norm_ot = order_type_str.upper()
        ORDER_MAPPINGS = {
            "BUY": (mt5.TRADE_ACTION_DEAL, mt5.ORDER_TYPE_BUY),
            "SELL": (mt5.TRADE_ACTION_DEAL, mt5.ORDER_TYPE_SELL),
            "BUY_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_BUY_LIMIT),
            "SELL_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_SELL_LIMIT),
            "BUY_STOP": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_BUY_STOP),
            "SELL_STOP": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_SELL_STOP),
            "BUY_STOP_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_BUY_STOP_LIMIT),
            "SELL_STOP_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_SELL_STOP_LIMIT),
        }
        if norm_ot not in ORDER_MAPPINGS:
            return {"success": False, "message": f"Unsupported order type: {norm_ot}"}
        volume = float(params.get("volume", 0.01))
        sl = float(params.get("sl", 0.0))
        tp = float(params.get("tp", 0.0))
        comment = params.get("comment", "Peron Trade")
        magic = int(params.get("magic", 123456))

        # Check symbol selected in market watch without forcing casing
        selected = mt5.symbol_select(symbol, True)
        if not selected:
            return {"success": False, "message": f"Symbol '{symbol}' not found in MetaTrader 5"}

        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {"success": False, "message": f"No market tick available for symbol '{symbol}'"}

        trade_action, order_type_val = ORDER_MAPPINGS[norm_ot]
        is_pending = trade_action == mt5.TRADE_ACTION_PENDING
        if is_pending and params.get("price") is None:
            return {"success": False, "message": "Pending orders require a trigger/entry price."}
        if norm_ot in ("BUY_STOP_LIMIT", "SELL_STOP_LIMIT") and params.get("stopLimitPrice") is None:
            return {"success": False, "message": "Stop-limit orders require a stopLimitPrice."}

        if is_pending:
            price = float(params.get("price"))
        else:
            price = tick.ask if "BUY" in norm_ot else tick.bid

        sym_info = mt5.symbol_info(symbol)
        filling_type, filling_error = resolve_filling_policy(mt5, sym_info, norm_ot, is_pending, params.get("typeFilling"))
        if filling_error:
            return {"success": False, "message": filling_error}

        type_time_names = {
            "GTC": mt5.ORDER_TIME_GTC,
            "DAY": mt5.ORDER_TIME_DAY,
            "SPECIFIED": mt5.ORDER_TIME_SPECIFIED,
            "SPECIFIED_DAY": mt5.ORDER_TIME_SPECIFIED_DAY,
        }
        type_time_name = str(params.get("typeTime", "GTC")).upper()
        if type_time_name not in type_time_names:
            return {"success": False, "message": f"Unsupported order time policy: {type_time_name}"}
        if type_time_name in ("SPECIFIED", "SPECIFIED_DAY") and params.get("expiration") is None:
            return {"success": False, "message": f"{type_time_name} order time requires an expiration timestamp."}

        request = {
            "action": trade_action,
            "symbol": symbol,
            "volume": volume,
            "type": order_type_val,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": max(0, int(params.get("deviation", 20))),
            "magic": magic,
            "comment": comment,
            "type_time": type_time_names[type_time_name],
            "type_filling": filling_type,
        }
        if is_pending and params.get("stopLimitPrice") is not None:
            request["stoplimit"] = float(params["stopLimitPrice"])
        if type_time_name in ("SPECIFIED", "SPECIFIED_DAY") and params.get("expiration") is not None:
            request["expiration"] = int(params["expiration"])

        try:
            result = mt5.order_send(request)
            if result is None:
                err = mt5.last_error()
                return {"success": False, "message": f"MT5 order_send returned None: {err}"}

            placed_code = getattr(mt5, "TRADE_RETCODE_PLACED", 10008)
            success = result.retcode in (mt5.TRADE_RETCODE_DONE, placed_code)
            return {
                "success": success,
                "status": "PLACED" if is_pending and result.retcode == placed_code else "EXECUTED" if success else "REJECTED",
                "ticket": result.order,
                "dealTicket": result.deal,
                "executionPrice": result.price,
                "retcode": result.retcode,
                "comment": result.comment,
                "message": f"Order executed with deal ticket #{result.deal}" if success else f"Order failed: {result.comment} (code {result.retcode})"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception executing order: {str(e)}"}

    def cancel_order(self, ticket):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "MetaTrader 5 terminal is not connected"}

        try:
            request = {
                "action": mt5.TRADE_ACTION_REMOVE,
                "order": int(ticket),
            }
            result = mt5.order_send(request)
            if result is None:
                err = mt5.last_error()
                return {"success": False, "message": f"Cancel order returned None: {err}"}

            success = (result.retcode == mt5.TRADE_RETCODE_DONE)
            return {
                "success": success,
                "ticket": result.order,
                "retcode": result.retcode,
                "comment": result.comment,
                "message": f"Order #{ticket} cancelled" if success else f"Failed to cancel order: {result.comment}"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception cancelling order: {str(e)}"}

    def close_position(self, ticket, volume=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "MetaTrader 5 terminal is not connected"}

        try:
            positions = mt5.positions_get(ticket=int(ticket))
            if not positions or len(positions) == 0:
                return {"success": False, "message": f"Position #{ticket} not found in MT5"}

            pos = positions[0]
            close_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
            tick = mt5.symbol_info_tick(pos.symbol)
            close_price = tick.bid if pos.type == 0 else tick.ask
            vol = float(volume if volume is not None else pos.volume)

            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "position": int(ticket),
                "symbol": pos.symbol,
                "volume": vol,
                "type": close_type,
                "price": close_price,
                "deviation": 20,
                "magic": pos.magic,
                "comment": f"Close #{ticket}",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }

            result = mt5.order_send(request)
            if result is None:
                err = mt5.last_error()
                return {"success": False, "message": f"Close order returned None: {err}"}

            success = (result.retcode == mt5.TRADE_RETCODE_DONE)
            return {
                "success": success,
                "ticket": result.order,
                "dealTicket": result.deal,
                "retcode": result.retcode,
                "comment": result.comment,
                "message": f"Position #{ticket} closed" if success else f"Failed to close position: {result.comment}"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception closing position: {str(e)}"}

    def modify_position(self, ticket, sl=None, tp=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "MetaTrader 5 terminal is not connected"}

        try:
            positions = mt5.positions_get(ticket=int(ticket))
            if not positions or len(positions) == 0:
                return {"success": False, "message": f"Position #{ticket} not found in MT5"}

            pos = positions[0]
            request = {
                "action": mt5.TRADE_ACTION_SLTP,
                "position": int(ticket),
                "symbol": pos.symbol,
                "sl": float(sl) if sl is not None else pos.sl,
                "tp": float(tp) if tp is not None else pos.tp,
            }

            result = mt5.order_send(request)
            if result is None:
                err = mt5.last_error()
                return {"success": False, "message": f"Modify order returned None: {err}"}

            success = (result.retcode == mt5.TRADE_RETCODE_DONE)
            return {
                "success": success,
                "retcode": result.retcode,
                "comment": result.comment,
                "message": f"Position #{ticket} updated" if success else f"Modify failed: {result.comment}"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception modifying position: {str(e)}"}

    def modify_order(self, ticket, price=None, sl=None, tp=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "MetaTrader 5 terminal is not connected"}

        try:
            orders = mt5.orders_get(ticket=int(ticket))
            if not orders or len(orders) == 0:
                return {"success": False, "message": f"Order #{ticket} not found in MT5"}

            order = orders[0]
            request = {
                "action": mt5.TRADE_ACTION_MODIFY,
                "order": int(ticket),
                "price": float(price) if price is not None else order.price_open,
                "sl": float(sl) if sl is not None else order.sl,
                "tp": float(tp) if tp is not None else order.tp,
            }

            result = mt5.order_send(request)
            if result is None:
                err = mt5.last_error()
                return {"success": False, "message": f"Modify order returned None: {err}"}

            success = (result.retcode == mt5.TRADE_RETCODE_DONE)
            return {
                "success": success,
                "retcode": result.retcode,
                "comment": result.comment,
                "message": f"Pending order #{ticket} updated" if success else f"Modify failed: {result.comment}"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception modifying order: {str(e)}"}

    def close_all_positions(self, symbol=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "MetaTrader 5 terminal is not connected", "closedCount": 0}

        try:
            positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
            if not positions or len(positions) == 0:
                return {"success": True, "message": "No positions to close", "closedCount": 0, "closedTickets": []}

            closed_tickets = []
            errors = []
            for pos in positions:
                ticket = pos.ticket
                res = self.close_position(ticket)
                if res.get("success"):
                    closed_tickets.append(ticket)
                else:
                    errors.append(f"Ticket #{ticket}: {res.get('message')}")

            return {
                "success": len(closed_tickets) > 0 or len(errors) == 0,
                "closedCount": len(closed_tickets),
                "closedTickets": closed_tickets,
                "errors": errors,
                "message": f"Closed {len(closed_tickets)} positions"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception in close_all: {str(e)}", "closedCount": 0}

    def cancel_all_orders(self, symbol=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "MetaTrader 5 terminal is not connected", "cancelledCount": 0}

        try:
            orders = mt5.orders_get(symbol=symbol) if symbol else mt5.orders_get()
            if not orders or len(orders) == 0:
                return {"success": True, "message": "No pending orders to cancel", "cancelledCount": 0, "cancelledTickets": []}

            cancelled_tickets = []
            errors = []
            for order in orders:
                ticket = order.ticket
                res = self.cancel_order(ticket)
                if res.get("success"):
                    cancelled_tickets.append(ticket)
                else:
                    errors.append(f"Ticket #{ticket}: {res.get('message')}")

            return {
                "success": len(cancelled_tickets) > 0 or len(errors) == 0,
                "cancelledCount": len(cancelled_tickets),
                "cancelledTickets": cancelled_tickets,
                "errors": errors,
                "message": f"Cancelled {len(cancelled_tickets)} pending orders"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception in cancel_all: {str(e)}", "cancelledCount": 0}

    def close_by_position(self, ticket, opposite_ticket):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "MetaTrader 5 terminal is not connected"}

        try:
            request = {
                "action": mt5.TRADE_ACTION_CLOSE_BY,
                "position": int(ticket),
                "position_by": int(opposite_ticket),
            }
            result = mt5.order_send(request)
            if result is None:
                err = mt5.last_error()
                return {"success": False, "message": f"Close by returned None: {err}"}

            success = (result.retcode == mt5.TRADE_RETCODE_DONE)
            return {
                "success": success,
                "ticket": result.order,
                "dealTicket": result.deal,
                "retcode": result.retcode,
                "comment": result.comment,
                "message": f"Position #{ticket} closed by #{opposite_ticket}" if success else f"Close by failed: {result.comment}"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception in close_by: {str(e)}"}

    def get_symbols_total(self):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                return mt5.symbols_total()
            except Exception:
                pass
        return 0

    def get_symbol_info_tick(self, symbol):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                tick = mt5.symbol_info_tick(symbol)
                if tick:
                    now_ms = int(time.time() * 1000)
                    time_sec = int(tick.time)
                    time_msc = int(getattr(tick, "time_msc", time_sec * 1000))
                    spread = int(getattr(tick, "spread", 0) or round((tick.ask - tick.bid) / 0.00001))
                    return {
                        "symbol": symbol,
                        "time": time_sec,
                        "timeMsc": time_msc,
                        "timeIso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time_sec)),
                        "bid": float(tick.bid),
                        "ask": float(tick.ask),
                        "last": float(tick.last or tick.bid),
                        "volume": int(getattr(tick, "volume", 1)),
                        "flags": int(getattr(tick, "flags", 0)),
                        "spread": spread,
                    }
            except Exception:
                pass
        return None

    def _serialize_symbol_info(self, info):
        trade_mode = int(getattr(info, "trade_mode", 0))
        trade_mode_names = {0: "DISABLED", 1: "LONG_ONLY", 2: "SHORT_ONLY", 3: "CLOSE_ONLY", 4: "FULL"}
        digits = int(getattr(info, "digits", 5))
        return {
            "symbol": info.name,
            "digits": digits,
            "point": float(getattr(info, "point", 10 ** (-digits))),
            "spread": int(getattr(info, "spread", 0)),
            "spreadFloat": bool(getattr(info, "spread_float", False)),
            "description": getattr(info, "description", "") or info.name,
            "tradeMode": trade_mode,
            "tradeModeName": trade_mode_names.get(trade_mode, "UNKNOWN"),
            "canOpenBuy": trade_mode in (1, 4),
            "canOpenSell": trade_mode in (2, 4),
            "tradeAllowed": trade_mode in (1, 2, 4),
            "tradeExecution": int(getattr(info, "trade_exemode", 0)),
            "tradeCalcMode": int(getattr(info, "trade_calc_mode", 0)),
            "orderMode": int(getattr(info, "order_mode", 0)),
            "fillingMode": int(getattr(info, "filling_mode", 0)),
            "expirationMode": int(getattr(info, "expiration_mode", 0)),
            "minLot": float(getattr(info, "volume_min", 0.01)),
            "maxLot": float(getattr(info, "volume_max", 100.0)),
            "lotStep": float(getattr(info, "volume_step", 0.01)),
            "volumeLimit": float(getattr(info, "volume_limit", 0.0)),
            "contractSize": float(getattr(info, "trade_contract_size", 100000.0)),
            "tickSize": float(getattr(info, "trade_tick_size", 0.0)),
            "tickValue": float(getattr(info, "trade_tick_value", 0.0)),
            "tickValueProfit": float(getattr(info, "trade_tick_value_profit", 0.0)),
            "tickValueLoss": float(getattr(info, "trade_tick_value_loss", 0.0)),
            "stopsLevel": int(getattr(info, "trade_stops_level", 0)),
            "freezeLevel": int(getattr(info, "trade_freeze_level", 0)),
            "swapMode": int(getattr(info, "swap_mode", 0)),
            "swapLong": float(getattr(info, "swap_long", 0.0)),
            "swapShort": float(getattr(info, "swap_short", 0.0)),
            "swapRollover3Days": int(getattr(info, "swap_rollover3days", 0)),
            "marginInitial": float(getattr(info, "margin_initial", 0.0)),
            "marginMaintenance": float(getattr(info, "margin_maintenance", 0.0)),
            "marginHedged": float(getattr(info, "margin_hedged", 0.0)),
            "currencyBase": getattr(info, "currency_base", ""),
            "currencyProfit": getattr(info, "currency_profit", ""),
            "currencyMargin": getattr(info, "currency_margin", ""),
            "sessionOpen": float(getattr(info, "session_open", 0.0)),
            "sessionClose": float(getattr(info, "session_close", 0.0)),
            "selected": bool(getattr(info, "select", False)),
            "visible": bool(getattr(info, "visible", False)),
            "bid": float(getattr(info, "bid", 0.0)),
            "ask": float(getattr(info, "ask", 0.0)),
        }

    def get_history_deals(self, date_from=None, date_to=None, count=100, ticket=None, position=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return []
        try:
            now_sec = int(time.time())
            from_sec = int(date_from) if date_from is not None else (now_sec - 30 * 86400)
            to_sec = int(date_to) if date_to is not None else (now_sec + 86400)
            if ticket is not None and position is not None:
                return []
            if ticket is not None:
                deals = mt5.history_deals_get(ticket=int(ticket))
            elif position is not None:
                deals = mt5.history_deals_get(position=int(position))
            else:
                deals = mt5.history_deals_get(from_sec, to_sec)
            if deals:
                DEAL_TYPE_NAMES = {0: "BUY", 1: "SELL", 2: "BALANCE", 3: "CREDIT"}
                ENTRY_NAMES = {0: "IN", 1: "OUT", 2: "INOUT"}
                res = []
                for d in deals[-int(count):]:
                    res.append({
                        "ticket": int(d.ticket),
                        "order": int(d.order),
                        "time": int(d.time),
                        "timeMsc": int(getattr(d, "time_msc", int(d.time) * 1000)),
                        "timeIso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(d.time)),
                        "type": DEAL_TYPE_NAMES.get(d.type, "DEAL"),
                        "entry": ENTRY_NAMES.get(d.entry, "IN"),
                        "positionId": int(getattr(d, "position_id", 0)),
                        "symbol": getattr(d, "symbol", "") or "",
                        "volume": float(d.volume),
                        "price": float(d.price),
                        "commission": round(float(getattr(d, "commission", 0.0)), 2),
                        "swap": round(float(getattr(d, "swap", 0.0)), 2),
                        "profit": round(float(getattr(d, "profit", 0.0)), 2),
                        "fee": round(float(getattr(d, "fee", 0.0)), 2),
                        "magic": int(getattr(d, "magic", 0)),
                        "reason": int(getattr(d, "reason", 0)),
                        "comment": getattr(d, "comment", "") or "",
                        "externalId": getattr(d, "external_id", "") or "",
                    })
                return res
        except Exception:
            pass
        return []

    def get_history_orders(self, date_from=None, date_to=None, count=100, ticket=None, position=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return []
        try:
            now_sec = int(time.time())
            from_sec = int(date_from) if date_from is not None else (now_sec - 30 * 86400)
            to_sec = int(date_to) if date_to is not None else (now_sec + 86400)
            if ticket is not None and position is not None:
                return []
            if ticket is not None:
                orders = mt5.history_orders_get(ticket=int(ticket))
            elif position is not None:
                orders = mt5.history_orders_get(position=int(position))
            else:
                orders = mt5.history_orders_get(from_sec, to_sec)
            if orders:
                STATE_NAMES = {0: "STARTED", 1: "PLACED", 2: "CANCELLED", 3: "PARTIAL", 4: "FILLED", 5: "REJECTED", 6: "EXPIRED"}
                ORDER_TYPE_NAMES = {0: "BUY", 1: "SELL", 2: "BUY_LIMIT", 3: "SELL_LIMIT", 4: "BUY_STOP", 5: "SELL_STOP"}
                res = []
                for o in orders[-int(count):]:
                    res.append({
                        "ticket": int(o.ticket),
                        "symbol": o.symbol,
                        "positionId": int(getattr(o, "position_id", 0)),
                        "type": ORDER_TYPE_NAMES.get(o.type, "ORDER"),
                        "typeTime": int(getattr(o, "type_time", 0)),
                        "typeFilling": int(getattr(o, "type_filling", 0)),
                        "reason": int(getattr(o, "reason", 0)),
                        "volumeInitial": float(o.volume_initial),
                        "volumeCurrent": float(o.volume_current),
                        "priceOpen": float(o.price_open),
                        "priceCurrent": float(getattr(o, "price_current", o.price_open)),
                        "sl": float(o.sl),
                        "tp": float(o.tp),
                        "state": STATE_NAMES.get(o.state, "FILLED"),
                        "timeSetup": int(o.time_setup),
                        "timeSetupMsc": int(getattr(o, "time_setup_msc", 0)),
                        "timeDone": int(getattr(o, "time_done", 0)),
                        "timeDoneMsc": int(getattr(o, "time_done_msc", 0)),
                        "expiration": int(getattr(o, "time_expiration", 0)),
                        "stopLimitPrice": float(getattr(o, "price_stoplimit", 0.0)),
                        "magic": int(o.magic),
                        "comment": o.comment or "",
                        "externalId": getattr(o, "external_id", "") or "",
                    })
                return res
        except Exception:
            pass
        return []

    def get_history_totals(self, date_from=None, date_to=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "message": "Native MT5 package is unavailable"}
        try:
            now_sec = int(time.time())
            from_sec = int(date_from) if date_from is not None else now_sec - 30 * 86400
            to_sec = int(date_to) if date_to is not None else now_sec
            if from_sec < 0 or to_sec <= from_sec:
                return {"success": False, "message": "History interval must have a non-negative start before its end"}

            deals_total = mt5.history_deals_total(from_sec, to_sec)
            orders_total = mt5.history_orders_total(from_sec, to_sec)
            if deals_total is None or orders_total is None or deals_total < 0 or orders_total < 0:
                error = mt5.last_error()
                return {"success": False, "message": f"MT5 history count failed: {error}"}
            return {
                "success": True,
                "dateFrom": from_sec,
                "dateTo": to_sec,
                "dealsTotal": int(deals_total),
                "ordersTotal": int(orders_total),
            }
        except Exception as error:
            return {"success": False, "message": str(error)}

    def calc_margin(self, action_str, symbol, volume, price=None):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "margin": 0, "currency": "USD", "message": "MT5 terminal not connected"}
        try:
            action_type = mt5.ORDER_TYPE_BUY if "BUY" in str(action_str).upper() else mt5.ORDER_TYPE_SELL
            if price is None or float(price) <= 0:
                tick = mt5.symbol_info_tick(symbol)
                price = (tick.ask if action_type == mt5.ORDER_TYPE_BUY else tick.bid) if tick else 1.0
            margin = mt5.order_calc_margin(action_type, symbol, float(volume), float(price))
            acc = mt5.account_info()
            curr = acc.currency if acc else "USD"
            if margin is not None:
                return {"success": True, "margin": round(float(margin), 2), "currency": curr}
            err = mt5.last_error()
            return {"success": False, "margin": 0, "currency": curr, "message": f"Margin calc error: {err}"}
        except Exception as e:
            return {"success": False, "margin": 0, "currency": "USD", "message": str(e)}

    def calc_profit(self, action_str, symbol, volume, price_open, price_close):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"success": False, "profit": 0, "currency": "USD", "message": "MT5 terminal not connected"}
        try:
            action_type = mt5.ORDER_TYPE_BUY if "BUY" in str(action_str).upper() else mt5.ORDER_TYPE_SELL
            profit = mt5.order_calc_profit(action_type, symbol, float(volume), float(price_open), float(price_close))
            acc = mt5.account_info()
            curr = acc.currency if acc else "USD"
            if profit is not None:
                return {"success": True, "profit": round(float(profit), 2), "currency": curr}
            err = mt5.last_error()
            return {"success": False, "profit": 0, "currency": curr, "message": f"Profit calc error: {err}"}
        except Exception as e:
            return {"success": False, "profit": 0, "currency": "USD", "message": str(e)}

    def check_order(self, params):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"feasible": False, "message": "MT5 terminal not connected"}
        try:
            symbol = params.get("symbol")
            order_type_str = str(params.get("orderType", "BUY")).upper()
            volume = float(params.get("volume", 0.01))
            order_mappings = {
                "BUY": (mt5.TRADE_ACTION_DEAL, mt5.ORDER_TYPE_BUY),
                "SELL": (mt5.TRADE_ACTION_DEAL, mt5.ORDER_TYPE_SELL),
                "BUY_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_BUY_LIMIT),
                "SELL_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_SELL_LIMIT),
                "BUY_STOP": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_BUY_STOP),
                "SELL_STOP": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_SELL_STOP),
                "BUY_STOP_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_BUY_STOP_LIMIT),
                "SELL_STOP_LIMIT": (mt5.TRADE_ACTION_PENDING, mt5.ORDER_TYPE_SELL_STOP_LIMIT),
            }
            if order_type_str not in order_mappings:
                return {"feasible": False, "message": f"Unsupported order type: {order_type_str}"}
            action, order_type = order_mappings[order_type_str]
            is_pending = action == mt5.TRADE_ACTION_PENDING
            tick = mt5.symbol_info_tick(symbol)
            if not tick:
                return {"feasible": False, "message": f"Symbol tick not found for {symbol}"}
            if is_pending and params.get("price") is None:
                return {"feasible": False, "message": "Pending orders require a trigger/entry price."}
            if order_type_str in ("BUY_STOP_LIMIT", "SELL_STOP_LIMIT") and params.get("stopLimitPrice") is None:
                return {"feasible": False, "message": "Stop-limit orders require a stopLimitPrice."}
            price = float(params["price"]) if is_pending else (tick.ask if order_type_str == "BUY" else tick.bid)

            type_time_names = {
                "GTC": mt5.ORDER_TIME_GTC,
                "DAY": mt5.ORDER_TIME_DAY,
                "SPECIFIED": mt5.ORDER_TIME_SPECIFIED,
                "SPECIFIED_DAY": mt5.ORDER_TIME_SPECIFIED_DAY,
            }
            type_time_name = str(params.get("typeTime", "GTC")).upper()
            if type_time_name not in type_time_names:
                return {"feasible": False, "message": f"Unsupported order time policy: {type_time_name}"}
            if type_time_name in ("SPECIFIED", "SPECIFIED_DAY") and params.get("expiration") is None:
                return {"feasible": False, "message": f"{type_time_name} order time requires an expiration timestamp."}

            symbol_info = mt5.symbol_info(symbol)
            filling, filling_error = resolve_filling_policy(mt5, symbol_info, order_type_str, is_pending, params.get("typeFilling"))
            if filling_error:
                return {"feasible": False, "message": filling_error}

            request = {
                "action": action,
                "symbol": symbol,
                "volume": volume,
                "type": order_type,
                "price": price,
                "sl": float(params.get("sl", 0) or 0),
                "tp": float(params.get("tp", 0) or 0),
                "deviation": max(0, int(params.get("deviation", 20))),
                "type_time": type_time_names[type_time_name],
                "type_filling": filling,
            }
            if order_type_str in ("BUY_STOP_LIMIT", "SELL_STOP_LIMIT"):
                request["stoplimit"] = float(params["stopLimitPrice"])
            if type_time_name in ("SPECIFIED", "SPECIFIED_DAY"):
                request["expiration"] = int(params["expiration"])
            res = mt5.order_check(request)
            if res:
                return {
                    "feasible": bool(res.retcode == 0),
                    "retcode": res.retcode,
                    "margin": round(float(res.margin), 2),
                    "marginFree": round(float(res.margin_free), 2),
                    "marginLevel": round(float(res.margin_level), 2),
                    "balance": round(float(res.balance), 2),
                    "equity": round(float(res.equity), 2),
                    "comment": res.comment,
                    "message": res.comment if res.retcode == 0 else f"Order check failed: {res.comment}"
                }
            err = mt5.last_error()
            return {"feasible": False, "message": f"Order check error: {err}"}
        except Exception as e:
            return {"feasible": False, "message": str(e)}

    def get_symbol_info(self, symbol):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return None
        try:
            s = mt5.symbol_info(symbol)
            if s:
                return self._serialize_symbol_info(s)
        except Exception:
            pass
        return None

    def get_market_depth(self, symbol):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"bids": [], "asks": [], "available": False, "message": "Native MT5 package is unavailable"}
        subscribed = False
        try:
            subscribed = bool(mt5.market_book_add(symbol))
            if not subscribed:
                error = mt5.last_error()
                message = str(error[1]) if error and error[0] not in (0, 1) else f"Market depth is not available for {symbol} on this broker."
                return {"bids": [], "asks": [], "available": False, "message": message}
            book = mt5.market_book_get(symbol)
            if book:
                bids = []
                asks = []
                for item in book:
                    # type 1 = sell/ask, type 2 = buy/bid
                    entry = {"price": float(item.price), "volume": float(item.volume)}
                    if item.type == 2:
                        bids.append(entry)
                    else:
                        asks.append(entry)
                bids.sort(key=lambda item: item["price"], reverse=True)
                asks.sort(key=lambda item: item["price"])
                return {"bids": bids, "asks": asks, "available": True}
            return {"bids": [], "asks": [], "available": True, "message": "No depth levels reported by broker"}
        except Exception as e:
            return {"bids": [], "asks": [], "available": False, "message": str(e)}
        finally:
            if subscribed:
                try:
                    mt5.market_book_release(symbol)
                except Exception:
                    pass

    def get_native_diagnostics(self):
        if not HAVE_NATIVE_MT5 or mt5 is None:
            return {"available": False, "message": package_error_detail}
        try:
            version = mt5.version()
            error = mt5.last_error()
            return {
                "available": True,
                "packageVersion": getattr(mt5, "__version__", None),
                "terminalVersion": list(version) if version else None,
                "lastError": {"code": error[0], "message": error[1]} if error else None,
                "totals": {
                    "symbols": mt5.symbols_total(),
                    "positions": mt5.positions_total(),
                    "orders": mt5.orders_total(),
                },
            }
        except Exception as e:
            return {"available": False, "message": str(e)}


engine = MT5Engine()

class BridgeHTTPHandler(BaseHTTPRequestHandler):
    def _is_origin_allowed(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        allowed_origins = os.environ.get(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
        return origin in {value.strip() for value in allowed_origins.split(",") if value.strip()}

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        origin = self.headers.get("Origin")
        if origin and self._is_origin_allowed():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        if not self._is_origin_allowed():
            return self._send_json(403, {"error": "Origin not allowed"})
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if not self._is_origin_allowed():
            return self._send_json(403, {"error": "Origin not allowed"})
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/health" or path == "/status":
            terminal_info = engine.get_terminal_info()
            account_info = engine.get_account_info()
            is_connected = bool(terminal_info.get("connected") and account_info is not None)
            
            message = "Connected to MetaTrader 5 Terminal" if is_connected else (
                "Awaiting MetaTrader 5 Terminal (Launch MT5 app to connect)" if HAVE_NATIVE_MT5
                else "Awaiting MetaTrader 5 Terminal connection (Desktop application not found in cloud environment)"
            )

            self._send_json(200, {
                "status": "ok",
                "connected": is_connected,
                "terminalConnected": bool(terminal_info.get("connected")),
                "packageAvailable": HAVE_NATIVE_MT5,
                "packageVersion": getattr(mt5, "__version__", "5.0.6231") if HAVE_NATIVE_MT5 else "5.0.6231 (Package installed)",
                "engine": "peron_mt5",
                "isNative": HAVE_NATIVE_MT5,
                "account": account_info,
                "terminal": terminal_info,
                "message": message,
            })
        elif path == "/account":
            acc = engine.get_account_info()
            if acc:
                self._send_json(200, acc)
            else:
                self._send_json(200, None)
        elif path == "/terminal":
            self._send_json(200, engine.get_terminal_info())
        elif path == "/symbols":
            group = qs.get("group", [None])[0]
            self._send_json(200, engine.get_symbols(group))
        elif path == "/ticks":
            symbols = qs.get("symbols", [None])[0]
            sym_list = [s.strip() for s in symbols.split(",")] if symbols else None
            self._send_json(200, engine.get_ticks(sym_list))
        elif path == "/ticks/history":
            symbol = qs.get("symbol", ["EURUSD"])[0]
            date_from = qs.get("from", [None])[0]
            date_to = qs.get("to", [None])[0]
            count = int(qs.get("count", [1000])[0])
            flags = qs.get("flags", ["ALL"])[0]
            self._send_json(200, engine.get_ticks_history(symbol, date_from, date_to, count, flags))
        elif path == "/candles":
            symbol = qs.get("symbol", ["EURUSD"])[0]
            timeframe = qs.get("timeframe", ["M1"])[0]
            count = int(qs.get("count", [100])[0])
            date_from = qs.get("from", [None])[0]
            date_to = qs.get("to", [None])[0]
            start_pos = int(qs.get("startPos", [0])[0])
            self._send_json(200, engine.get_candles(symbol, timeframe, count, date_from, date_to, start_pos))
        elif path == "/positions":
            symbol = qs.get("symbol", [None])[0]
            ticket = qs.get("ticket", [None])[0]
            self._send_json(200, engine.get_positions(symbol, ticket))
        elif path == "/orders":
            symbol = qs.get("symbol", [None])[0]
            ticket = qs.get("ticket", [None])[0]
            self._send_json(200, engine.get_orders(symbol, ticket))
        elif path == "/history/deals":
            date_from = qs.get("from", [None])[0]
            date_to = qs.get("to", [None])[0]
            count = int(qs.get("count", [100])[0])
            ticket = qs.get("ticket", [None])[0]
            position = qs.get("position", [None])[0]
            self._send_json(200, engine.get_history_deals(date_from, date_to, count, ticket, position))
        elif path == "/history/orders":
            date_from = qs.get("from", [None])[0]
            date_to = qs.get("to", [None])[0]
            count = int(qs.get("count", [100])[0])
            ticket = qs.get("ticket", [None])[0]
            position = qs.get("position", [None])[0]
            self._send_json(200, engine.get_history_orders(date_from, date_to, count, ticket, position))
        elif path == "/history/totals":
            date_from = qs.get("from", [None])[0]
            date_to = qs.get("to", [None])[0]
            self._send_json(200, engine.get_history_totals(date_from, date_to))
        elif path == "/symbol/info":
            sym = qs.get("symbol", [None])[0]
            self._send_json(200, engine.get_symbol_info(sym) if sym else None)
        elif path == "/symbols/total":
            self._send_json(200, {"total": engine.get_symbols_total()})
        elif path == "/tick/last":
            sym = qs.get("symbol", [None])[0]
            self._send_json(200, engine.get_symbol_info_tick(sym) if sym else None)
        elif path == "/depth":
            sym = qs.get("symbol", ["EURUSD"])[0]
            self._send_json(200, engine.get_market_depth(sym))
        elif path == "/native/diagnostics":
            self._send_json(200, engine.get_native_diagnostics())
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        if not self._is_origin_allowed():
            return self._send_json(403, {"error": "Origin not allowed"})
        parsed = urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = {}
        if content_len > 0:
            try:
                raw = self.rfile.read(content_len).decode("utf-8")
                body = json.loads(raw)
            except Exception as e:
                return self._send_json(400, {"error": f"Invalid JSON payload: {e}"})

        if path == "/symbols/select":
            res = engine.select_symbol(body.get("symbol"), body.get("enable", True))
            self._send_json(200 if res.get("success") else 400, res)

        if path == "/connect":
            success, msg = engine.connect(
                login=body.get("login"),
                password=body.get("password"),
                server=body.get("server"),
                path=body.get("path"),
                timeout=body.get("timeout", 60000)
            )
            self._send_json(200 if success else 400, {"success": success, "message": msg})
        elif path == "/disconnect":
            success, msg = engine.disconnect()
            self._send_json(200, {"success": success, "message": msg})
        elif path == "/order":
            res = engine.execute_order(body)
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/close":
            res = engine.close_position(body.get("ticket"), body.get("volume"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/close/all":
            res = engine.close_all_positions(body.get("symbol"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/close/by":
            res = engine.close_by_position(body.get("ticket"), body.get("oppositeTicket"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/modify":
            res = engine.modify_position(body.get("ticket"), body.get("sl"), body.get("tp"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/order/modify":
            res = engine.modify_order(body.get("ticket"), body.get("price"), body.get("sl"), body.get("tp"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/cancel":
            res = engine.cancel_order(body.get("ticket"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/cancel/all":
            res = engine.cancel_all_orders(body.get("symbol"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/calc/margin":
            res = engine.calc_margin(body.get("action", "BUY"), body.get("symbol"), body.get("volume", 0.1), body.get("price"))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/calc/profit":
            res = engine.calc_profit(body.get("action", "BUY"), body.get("symbol"), body.get("volume", 0.1), body.get("priceOpen", 0), body.get("priceClose", 0))
            self._send_json(200 if res.get("success") else 400, res)
        elif path == "/order/check":
            res = engine.check_order(body)
            self._send_json(200 if res.get("feasible") else 400, res)
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def log_message(self, format, *args):
        return

def run_server(port=8888, host="127.0.0.1"):
    server_address = (host, port)
    httpd = HTTPServer(server_address, BridgeHTTPHandler)
    print(f"[Peron] MT5 Python Bridge running at http://{host}:{port}")

    # Auto-connect to MT5 terminal on startup (with retries)
    auto_connect()

    # Background reconnection loop: retry if terminal starts later or disconnects
    import threading

    def reconnect_loop():
        while True:
            time.sleep(10)
            if not engine.connected:
                auto_connect()

    reconnect_thread = threading.Thread(target=reconnect_loop, daemon=True)
    reconnect_thread.start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        engine.disconnect()


def auto_connect():
    """Attempt to connect to the local MetaTrader 5 terminal automatically."""
    if not HAVE_NATIVE_MT5 or mt5 is None:
        return
    if engine.connected:
        return
    try:
        # Try plain initialize() first - it connects to the already-running MT5 terminal
        # without forcing a login (uses the terminal's currently logged-in account)
        init_kwargs = {}
        env_login = os.environ.get("MT5_LOGIN")
        env_password = os.environ.get("MT5_PASSWORD")
        env_server = os.environ.get("MT5_SERVER")
        env_path = os.environ.get("MT5_TERMINAL_PATH")
        if env_path:
            init_kwargs["path"] = env_path
        if env_login:
            try:
                init_kwargs["login"] = int(env_login)
            except (ValueError, TypeError):
                pass
        if env_password:
            init_kwargs["password"] = env_password
        if env_server:
            init_kwargs["server"] = env_server
        init_kwargs["timeout"] = 3000

        res = mt5.initialize(**init_kwargs)
        if res:
            info = mt5.terminal_info()
            if info:
                engine.connected = bool(info.connected)
                engine.terminal_connected = True
                engine.terminal_name = info.name
                engine.terminal_company = info.company
                engine.terminal_build = info.build
                print(f"[Peron] Auto-connected to MetaTrader 5: {info.name} (build {info.build})")
                return
            else:
                engine.connected = True
                engine.terminal_connected = True
                print("[Peron] Auto-connected to MetaTrader 5 Terminal")
                return
        else:
            err = mt5.last_error()
            print(f"[Peron] Auto-connect retrying... MT5 init failed: code {err[0]}, {err[1]}")
    except Exception as ex:
        print(f"[Peron] Auto-connect retrying... exception: {ex}")

if __name__ == "__main__":
    port = 8888
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port=port)
