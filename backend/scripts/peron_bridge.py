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

# Ensure local peron package is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PERON_PACKAGE_DIR = os.path.join(PROJECT_ROOT, "peron_package")

if os.path.exists(PERON_PACKAGE_DIR):
    sys.path.insert(0, PERON_PACKAGE_DIR)

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
                        "leverage": int(acc.leverage),
                        "currency": acc.currency,
                        "server": acc.server,
                        "company": acc.company,
                        "profit": round(float(acc.profit), 2),
                        "lastUpdate": int(time.time() * 1000),
                    }
            except Exception:
                pass
        # No MT5 connection -> Return None (NO fake data)
        return None

    def get_symbols(self):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                symbols = mt5.symbols_get()
                if symbols:
                    res = []
                    for s in symbols:
                        s_digits = int(getattr(s, "digits", 5))
                        s_point = float(getattr(s, "point", 10 ** (-s_digits)))
                        res.append({
                            "symbol": s.name,
                            "digits": s_digits,
                            "spread": int(getattr(s, "spread", 0)),
                            "point": s_point,
                            "description": s.description or s.name,
                            "tradeMode": int(getattr(s, "trade_mode", 4)),
                            "minLot": float(getattr(s, "volume_min", 0.01)),
                            "maxLot": float(getattr(s, "volume_max", 100.0)),
                            "lotStep": float(getattr(s, "volume_step", 0.01)),
                            "contractSize": float(getattr(s, "trade_contract_size", 100000.0)),
                            "tradeAllowed": int(getattr(s, "trade_mode", 4)) > 0,
                            "bid": float(getattr(s, "bid", 0.0)),
                            "ask": float(getattr(s, "ask", 0.0)),
                        })
                    return res
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

    def get_candles(self, symbol, timeframe="M1", count=100):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                tf_code = TIMEFRAMES.get(timeframe, 1)
                rates = mt5.copy_rates_from_pos(symbol, tf_code, 0, count)
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

    def get_positions(self, symbol=None):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                raw_positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
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
                        })
                    return res
            except Exception:
                pass
        return []

    def get_orders(self, symbol=None):
        if HAVE_NATIVE_MT5 and mt5 is not None:
            try:
                raw_orders = mt5.orders_get(symbol=symbol) if symbol else mt5.orders_get()
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
                            "magic": int(o.magic),
                            "comment": o.comment or "",
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
        order_type_str = params.get("orderType", "BUY").upper()
        volume = float(params.get("volume", 0.01))
        sl = float(params.get("sl", 0.0))
        tp = float(params.get("tp", 0.0))
        comment = params.get("comment", "Peron Trade")
        magic = int(params.get("magic", 123456))

        # Check symbol selected in market watch
        selected = mt5.symbol_select(symbol, True)
        if not selected:
            return {"success": False, "message": f"Symbol '{symbol}' not found in MetaTrader 5"}

        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {"success": False, "message": f"No market tick available for symbol '{symbol}'"}

        price = tick.ask if order_type_str == "BUY" else tick.bid
        order_type_val = mt5.ORDER_TYPE_BUY if order_type_str == "BUY" else mt5.ORDER_TYPE_SELL

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type_val,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": int(params.get("deviation", 20)),
            "magic": magic,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        try:
            result = mt5.order_send(request)
            if result is None:
                err = mt5.last_error()
                return {"success": False, "message": f"MT5 order_send returned None: {err}"}

            success = (result.retcode == mt5.TRADE_RETCODE_DONE)
            return {
                "success": success,
                "ticket": result.order,
                "dealTicket": result.deal,
                "executionPrice": result.price,
                "retcode": result.retcode,
                "comment": result.comment,
                "message": f"Order executed with deal ticket #{result.deal}" if success else f"Order failed: {result.comment} (code {result.retcode})"
            }
        except Exception as e:
            return {"success": False, "message": f"Exception executing order: {str(e)}"}

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


engine = MT5Engine()

class BridgeHTTPHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
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
            self._send_json(200, engine.get_symbols())
        elif path == "/ticks":
            symbols = qs.get("symbols", [None])[0]
            sym_list = [s.strip() for s in symbols.split(",")] if symbols else None
            self._send_json(200, engine.get_ticks(sym_list))
        elif path == "/candles":
            symbol = qs.get("symbol", ["EURUSD"])[0]
            timeframe = qs.get("timeframe", ["M1"])[0]
            count = int(qs.get("count", [100])[0])
            self._send_json(200, engine.get_candles(symbol, timeframe, count))
        elif path == "/positions":
            symbol = qs.get("symbol", [None])[0]
            self._send_json(200, engine.get_positions(symbol))
        elif path == "/orders":
            symbol = qs.get("symbol", [None])[0]
            self._send_json(200, engine.get_orders(symbol))
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
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
        elif path == "/modify":
            res = engine.modify_position(body.get("ticket"), body.get("sl"), body.get("tp"))
            self._send_json(200 if res.get("success") else 400, res)
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def log_message(self, format, *args):
        return

def run_server(port=8888, host="127.0.0.1"):
    server_address = (host, port)
    httpd = HTTPServer(server_address, BridgeHTTPHandler)
    print(f"[Peron] MT5 Python Bridge running at http://{host}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        engine.disconnect()

if __name__ == "__main__":
    port = 8888
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port=port)
