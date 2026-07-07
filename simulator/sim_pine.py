"""
YKP SRI ICT Silver Bullet — Pine Script logic simulator.
Replays indicator logic bar-by-bar on real XAUUSDT M15 (Binance) data.
Outputs: signals log + PNG chart with BUY/SELL markers + FVG boxes + DOL lines.

Usage: python sim_pine.py [--bars 2000] [--tf 15m] [--out out.png]
"""
import argparse
import json
import sys
import time
import urllib.request
import urllib.error
import ssl
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd
import mplfinance as mpf
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import yfinance as yf


# ---------------- Pine input defaults ----------------
LOOKBACK = 5
SETUP_TTL = 10
MSS_BODY_ONLY = True
HTF_MINUTES = 240  # H4
SB_TZ_OFFSET = 7  # Asia/Jakarta UTC+7 (Binance feeds UTC)
SB_WINDOWS = {
    "ASIA_SB": (10 * 60, 11 * 60),   # 10:00-11:00
    "LONDON_SB": (14 * 60, 15 * 60),
    "NY_SB": (19 * 30, 20 * 30),
}
SMT_ENABLED = True
SMT_MIN_CORR = 0.6
CORR_SYMBOL = "EURUSDT"  # Binance has no EURUSD OANDA; use EURUSDT as proxy
MAX_FVG_BOXES = 8


# ---------------- Data fetch ----------------
def fetch_klines(symbol, interval, limit=1500, end_time=None):
    """Fetch Binance klines with proper TLS verification. interval: '15m','1h','4h'."""
    url = "https://api.binance.com/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    if end_time:
        params["endTime"] = end_time
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    full = f"{url}?{qs}"
    req = urllib.request.Request(full, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = json.loads(r.read())
    df = pd.DataFrame(raw, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "qav", "trades", "tbb", "tbq", "ignore"
    ])
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms", utc=True)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df.set_index("open_time", inplace=True)
    return df


def fetch_yf(symbol, interval, limit=1500):
    """yfinance fallback. interval: '15m','60m','1d'. Returns df matching Binance schema."""
    period_map = {"15m": "60d", "60m": "730d", "1d": "max"}
    period = period_map.get(interval, "60d")
    # yf interval strings: 15m, 60m, 1h, 1d
    yf_int = interval if interval != "1h" else "60m"
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=period, interval=yf_int)
    if hist.empty:
        raise ValueError(f"yfinance returned empty for {symbol} {interval}")
    hist = hist.tail(limit)
    hist.index = hist.index.tz_convert("UTC") if hist.index.tz else hist.index.tz_localize("UTC")
    hist = hist.rename(columns={"Open": "open", "High": "high", "Low": "low",
                                "Close": "close", "Volume": "volume"})
    df = hist[["open", "high", "low", "close", "volume"]].copy()
    df.index.name = "open_time"
    return df


# ---------------- Pine helpers ported ----------------
def pivothigh(arr, left, right):
    """Return series with pivot high at index where arr[i-left..i] < arr[i] > arr[i+1..i+right], NaN otherwise.
    Mirrors ta.pivothigh — value at the pivot bar (i), detection lagged by `right` bars.
    """
    n = len(arr)
    out = np.full(n, np.nan)
    # pivot at i is confirmed at i+right
    for i in range(left, n - right):
        val = arr[i]
        left_ok = all(arr[i - k] < val for k in range(1, left + 1))
        right_ok = all(arr[i + k] < val for k in range(1, right + 1))
        if left_ok and right_ok:
            out[i] = val
    return out


def pivotlow(arr, left, right):
    n = len(arr)
    out = np.full(n, np.nan)
    for i in range(left, n - right):
        val = arr[i]
        left_ok = all(arr[i - k] > val for k in range(1, left + 1))
        right_ok = all(arr[i + k] > val for k in range(1, right + 1))
        if left_ok and right_ok:
            out[i] = val
    return out


# ---------------- Simulation core ----------------
def simulate(df, df_htf, df_corr):
    """
    df: M15 OHLC indexed by open_time
    df_htf: H4 OHLC
    df_corr: correlation pair M15 (EURUSDT)
    Returns df with signal columns + fvg boxes + dol lines.
    """
    # Reindex HTF to M15 via merge-as-of (last confirmed HTF bar — non-repaint)
    df = df.copy()
    df_htf = df_htf.copy()
    df_corr = df_corr.copy()

    # HTF pivots computed on HTF bars, then forward-filled to M15 (1 HTF bar lag)
    ph_htf = pivothigh(df_htf["high"].values, LOOKBACK, LOOKBACK)
    pl_htf = pivotlow(df_htf["low"].values, LOOKBACK, LOOKBACK)
    df_htf["ph_htf"] = ph_htf
    df_htf["pl_htf"] = pl_htf
    df_htf["htf_close"] = df_htf["close"]

    # lastHtfHigh/Low tracked on HTF, ffilled to M15
    last_high = np.nan
    last_low = np.nan
    # Track arrays of recent HTF swing highs/lows (we'll filter to nearest valid per HTF bar, then merge to M15).
    swing_highs_history = []
    swing_lows_history = []
    htf_last_high = []
    htf_last_low = []
    htf_closes = []
    htf_nearest_bsl = []   # nearest swing high ABOVE HTF close at this HTF bar
    htf_nearest_ssl = []   # nearest swing low BELOW HTF close at this HTF bar
    for i in range(len(df_htf)):
        if not np.isnan(ph_htf[i]):
            last_high = ph_htf[i]
            swing_highs_history.append(ph_htf[i])
        if not np.isnan(pl_htf[i]):
            last_low = pl_htf[i]
            swing_lows_history.append(pl_htf[i])
        htf_last_high.append(last_high)
        htf_last_low.append(last_low)
        h = df_htf["high"].values[i]
        l = df_htf["low"].values[i]
        c = df_htf["close"].values[i]
        htf_closes.append(c)
        # nearest above/below using history of swings
        above = [v for v in swing_highs_history if v > c]
        below = [v for v in swing_lows_history if v < c]
        htf_nearest_bsl.append(min(above) if above else np.nan)
        htf_nearest_ssl.append(max(below) if below else np.nan)
    df_htf["last_hth"] = htf_last_high
    df_htf["last_htl"] = htf_last_low
    df_htf["htf_close_lag"] = df_htf["htf_close"].shift(1)
    df_htf["nearest_bsl"] = htf_nearest_bsl
    df_htf["nearest_ssl"] = htf_nearest_ssl

    htf_trend_series = np.zeros(len(df_htf))
    ht = 0
    ht_init = False
    last_lhh = np.nan
    last_lhl = np.nan
    htf_close_series = df_htf["close"].values
    for i in range(len(df_htf)):
        lhh = htf_last_high[i]
        lhl = htf_last_low[i]
        hc_prev = htf_close_series[i - 1] if i > 0 else np.nan
        hc = htf_close_series[i]
        bull_break = (not np.isnan(lhh)) and (not np.isnan(hc_prev)) and hc > lhh and hc_prev <= lhh
        bear_break = (not np.isnan(lhl)) and (not np.isnan(hc_prev)) and hc < lhl and hc_prev >= lhl
        if bull_break and not ht_init:
            ht = 1; ht_init = True
        elif bear_break and not ht_init:
            ht = -1; ht_init = True
        elif bull_break and ht_init:
            ht = 1
        elif bear_break and ht_init:
            ht = -1
        htf_trend_series[i] = ht
    df_htf["htf_trend"] = htf_trend_series
    df = df.drop(columns=[c for c in ["htf_trend"] if c in df.columns], errors="ignore")
    df = df.merge(df_htf[["htf_trend"]], left_index=True, right_index=True, how="left", sort=True)
    df["htf_trend"] = df["htf_trend"].ffill().fillna(0).astype(int)

    # DOL — nearest valid HTF swing mapped to each M15 bar (forward-fill HTF values to M15).
    htf_state = df_htf[["last_hth", "last_htl", "htf_close_lag", "nearest_bsl", "nearest_ssl"]].copy()
    htf_state.columns = ["last_hth", "last_htl", "htf_close_lag", "nearest_bsl_htf", "nearest_ssl_htf"]
    df = df.merge(htf_state, left_index=True, right_index=True, how="left", sort=True)
    for c in ["last_hth", "last_htl", "htf_close_lag", "nearest_bsl_htf", "nearest_ssl_htf"]:
        df[c] = df[c].ffill()
    df["dol_buyside"] = df["nearest_bsl_htf"]
    df["dol_sellside"] = df["nearest_ssl_htf"]

    # Signal-TF pivots (M15)
    ph_sig = pivothigh(df["high"].values, LOOKBACK, LOOKBACK)
    pl_sig = pivotlow(df["low"].values, LOOKBACK, LOOKBACK)
    df["ph_sig"] = ph_sig
    df["pl_sig"] = pl_sig

    last_swing_high = np.nan
    last_swing_low = np.nan
    lsh = []
    lsl = []
    for i in range(len(df)):
        if not np.isnan(ph_sig[i]):
            last_swing_high = ph_sig[i]
        if not np.isnan(pl_sig[i]):
            last_swing_low = pl_sig[i]
        lsh.append(last_swing_high)
        lsl.append(last_swing_low)
    df["last_sh"] = lsh
    df["last_sl"] = lsl

    # Sweep / MSS / IFVG / FVG — iterate bar by bar
    htf_bias = np.where(df["htf_trend"] == 1, "BULL", np.where(df["htf_trend"] == -1, "BEAR", "NEUTRAL"))
    df["htf_bias"] = htf_bias

    bars_since_sweep_ssl = np.full(len(df), np.nan)
    bars_since_sweep_bsl = np.full(len(df), np.nan)
    bars_since_mss_bull = np.full(len(df), np.nan)
    bars_since_mss_bear = np.full(len(df), np.nan)

    bull_fvg = []  # list of dicts {left_idx, right_idx, top, bottom, alive}
    bear_fvg = []
    bull_fvg_anchor_time = np.nan
    bear_fvg_anchor_time = np.nan

    sweep_ssl = np.zeros(len(df), dtype=bool)
    sweep_bsl = np.zeros(len(df), dtype=bool)
    mss_bull = np.zeros(len(df), dtype=bool)
    mss_bear = np.zeros(len(df), dtype=bool)
    ifvg_bull = np.zeros(len(df), dtype=bool)
    ifvg_bear = np.zeros(len(df), dtype=bool)
    smt_bull = np.zeros(len(df), dtype=bool)
    smt_bear = np.zeros(len(df), dtype=bool)

    sb_active = np.zeros(len(df), dtype=bool)
    sb_session = ["NONE"] * len(df)
    sb_entry = np.zeros(len(df), dtype=bool)

    # corr pair close aligned to df via merge-as-of
    df = df.merge(df_corr[["close"]].rename(columns={"close": "corr_close"}),
                  left_index=True, right_index=True, how="left", sort=True)
    df["corr_close"] = df["corr_close"].ffill()
    df["corr_low"] = df_corr["low"].reindex(df.index, method="ffill").values
    df["corr_high"] = df_corr["high"].reindex(df.index, method="ffill").values

    # rolling correlation 30
    df["corr_strength"] = df["close"].rolling(30).corr(df["corr_close"])

    opens = df["open"].values
    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    times = df.index

    prev_sb_active = False
    for i in range(len(df)):
        # SB windows: convert bar open_time to Jakarta local minutes
        t = times[i]
        local = t + timedelta(hours=SB_TZ_OFFSET)
        minute_of_day = local.hour * 60 + local.minute
        sb = False
        sess = "NONE"
        for name, (start, end) in SB_WINDOWS.items():
            if start <= minute_of_day < end:
                sb = True
                sess = name
                break
        sb_active[i] = sb
        sb_session[i] = sess
        sb_entry[i] = sb and not prev_sb_active
        prev_sb_active = sb

        bias = htf_bias[i]
        dol_bs = df["dol_buyside"].values[i]
        dol_ss = df["dol_sellside"].values[i]

        # Sweep SSL (bull): low < dolSellSide and close > dolSellSide
        if (bias in ("BULL", "NEUTRAL")) and not np.isnan(dol_ss):
            if lows[i] < dol_ss and closes[i] > dol_ss:
                sweep_ssl[i] = True
        if (bias in ("BEAR", "NEUTRAL")) and not np.isnan(dol_bs):
            if highs[i] > dol_bs and closes[i] < dol_bs:
                sweep_bsl[i] = True

        if sweep_ssl[i]:
            bars_since_sweep_ssl[i] = 0
        elif i > 0 and not np.isnan(bars_since_sweep_ssl[i - 1]):
            bars_since_sweep_ssl[i] = bars_since_sweep_ssl[i - 1] + 1

        if sweep_bsl[i]:
            bars_since_sweep_bsl[i] = 0
        elif i > 0 and not np.isnan(bars_since_sweep_bsl[i - 1]):
            bars_since_sweep_bsl[i] = bars_since_sweep_bsl[i - 1] + 1

        # MSS — body-close break of last swing
        lsh_i = df["last_sh"].values[i]
        lsl_i = df["last_sl"].values[i]
        c_prev = closes[i - 1] if i > 0 else np.nan
        mss_bull_break = (not np.isnan(lsh_i)) and closes[i] > lsh_i and c_prev <= lsh_i
        mss_bear_break = (not np.isnan(lsl_i)) and closes[i] < lsl_i and c_prev >= lsl_i

        valid_sweep_bull = not np.isnan(bars_since_sweep_ssl[i]) and bars_since_sweep_ssl[i] < SETUP_TTL
        valid_sweep_bear = not np.isnan(bars_since_sweep_bsl[i]) and bars_since_sweep_bsl[i] < SETUP_TTL

        if (bias in ("BULL", "NEUTRAL")) and (not np.isnan(lsh_i)) and mss_bull_break and valid_sweep_bull:
            mss_bull[i] = True
        if (bias in ("BEAR", "NEUTRAL")) and (not np.isnan(lsl_i)) and mss_bear_break and valid_sweep_bear:
            mss_bear[i] = True

        if mss_bull[i]:
            bars_since_sweep_ssl[i] = np.nan
        if mss_bear[i]:
            bars_since_sweep_bsl[i] = np.nan

        if mss_bull[i]:
            bars_since_mss_bull[i] = 0
        elif i > 0 and not np.isnan(bars_since_mss_bull[i - 1]):
            bars_since_mss_bull[i] = bars_since_mss_bull[i - 1] + 1

        if mss_bear[i]:
            bars_since_mss_bear[i] = 0
        elif i > 0 and not np.isnan(bars_since_mss_bear[i - 1]):
            bars_since_mss_bear[i] = bars_since_mss_bear[i - 1] + 1

        # FVG creation (on confirmed bar — in sim every historical bar is confirmed)
        if i >= 2:
            if lows[i] > highs[i - 2]:
                # bull FVG: top=low[i], bottom=high[i-2]
                bull_fvg.append({
                    "left_idx": i - 2, "right_idx": i,
                    "top": lows[i], "bottom": highs[i - 2], "alive": True
                })
                if len(bull_fvg) > MAX_FVG_BOXES:
                    bull_fvg.pop(0)
                bull_fvg_anchor_time = i
            if highs[i] < lows[i - 2]:
                bear_fvg.append({
                    "left_idx": i - 2, "right_idx": i,
                    "top": lows[i - 2], "bottom": highs[i], "alive": True
                })
                if len(bear_fvg) > MAX_FVG_BOXES:
                    bear_fvg.pop(0)
                bear_fvg_anchor_time = i

        # Mitigation: body-close
        for b in bull_fvg:
            if b["alive"] and closes[i] >= b["bottom"]:
                b["alive"] = False
        for b in bear_fvg:
            if b["alive"] and closes[i] <= b["top"]:
                b["alive"] = False

        active_bull_fvg = any(b["alive"] for b in bull_fvg)
        active_bear_fvg = any(b["alive"] for b in bear_fvg)

        if (active_bull_fvg and (bias in ("BULL", "NEUTRAL"))
                and not np.isnan(bars_since_mss_bull[i]) and bars_since_mss_bull[i] < SETUP_TTL
                and not np.isnan(bull_fvg_anchor_time)):
            ifvg_bull[i] = True
        if (active_bear_fvg and (bias in ("BEAR", "NEUTRAL"))
                and not np.isnan(bars_since_mss_bear[i]) and bars_since_mss_bear[i] < SETUP_TTL
                and not np.isnan(bear_fvg_anchor_time)):
            ifvg_bear[i] = True

        # SMT
        cs = df["corr_strength"].values[i] if not np.isnan(df["corr_strength"].values[i]) else 0
        if SMT_ENABLED and abs(cs) >= SMT_MIN_CORR:
            if sweep_ssl[i] and df["corr_low"].values[i - 1] >= df["corr_low"].values[i - 2]:
                smt_bull[i] = True
            if sweep_bsl[i] and df["corr_high"].values[i - 1] <= df["corr_high"].values[i - 2]:
                smt_bear[i] = True

    df["sweep_ssl"] = sweep_ssl
    df["sweep_bsl"] = sweep_bsl
    df["mss_bull"] = mss_bull
    df["mss_bear"] = mss_bear
    df["ifvg_bull"] = ifvg_bull
    df["ifvg_bear"] = ifvg_bear
    df["smt_bull"] = smt_bull
    df["smt_bear"] = smt_bear
    df["sb_active"] = sb_active
    df["sb_session"] = sb_session
    df["sb_entry"] = sb_entry
    df["bars_since_sweep_ssl"] = bars_since_sweep_ssl
    df["bars_since_sweep_bsl"] = bars_since_sweep_bsl
    df["bars_since_mss_bull"] = bars_since_mss_bull
    df["bars_since_mss_bear"] = bars_since_mss_bear

    # final signals (rising edge — single fire)
    df["buy"] = df["ifvg_bull"] & ~df["ifvg_bull"].shift(1, fill_value=False)
    df["sell"] = df["ifvg_bear"] & ~df["ifvg_bear"].shift(1, fill_value=False)

    return df, bull_fvg, bear_fvg


def render(df, bull_fvg, bear_fvg, out_path):
    # Trim to last 600 bars for readable chart
    last = df.tail(600).copy()
    bf = [b for b in bull_fvg if b["left_idx"] >= (len(df) - 600)]
    sf = [b for b in bear_fvg if b["left_idx"] >= (len(df) - 600)]

    # mpf expects columns in lowercase o,h,l,c,v
    plot_df = last[["open", "high", "low", "close", "volume"]].copy()
    plot_df.index.name = "Date"

    markers = []
    # BUY markers (below bar)
    buy_idx = last.index[last["buy"]]
    buy_prices = last["low"][last["buy"]] * 0.998
    sell_idx = last.index[last["sell"]]
    sell_prices = last["high"][last["sell"]] * 1.002

    aps = []
    if len(buy_idx):
        aps.append(mpf.make_addplot(buy_prices, type="scatter", marker="^", markersize=120, color="green", panel=0))
    if len(sell_idx):
        aps.append(mpf.make_addplot(sell_prices, type="scatter", marker="v", markersize=120, color="red", panel=0))

    # FVG boxes via matplotlib rectangles overlaid after mpf
    fig, axes = mpf.plot(plot_df, type="candle", style="nightclouds", volume=True,
                         addplot=aps if aps else [], returnfig=True, figratio=(18, 9), figscale=1.2)
    ax = axes[0]

    # FVG boxes
    for b in bf:
        if not b["alive"]:
            continue
        x0 = df.index[b["left_idx"]]
        x1 = df.index[b["right_idx"]]
        if x1 < last.index[0]:
            continue
        rect = mpatches.Rectangle((x0, b["bottom"]), x1 - x0, b["top"] - b["bottom"],
                                   linewidth=1, edgecolor="green", facecolor="green", alpha=0.3)
        ax.add_patch(rect)
    for b in sf:
        if not b["alive"]:
            continue
        x0 = df.index[b["left_idx"]]
        x1 = df.index[b["right_idx"]]
        if x1 < last.index[0]:
            continue
        rect = mpatches.Rectangle((x0, b["bottom"]), x1 - x0, b["top"] - b["bottom"],
                                   linewidth=1, edgecolor="red", facecolor="red", alpha=0.3)
        ax.add_patch(rect)

    # DOL lines (extend to last bar)
    last_dol_bs = df["dol_buyside"].dropna()
    last_dol_ss = df["dol_sellside"].dropna()
    if len(last_dol_bs):
        ax.axhline(y=last_dol_bs.iloc[-1], color="red", linestyle="--", alpha=0.5, label="DOL BSL")
    if len(last_dol_ss):
        ax.axhline(y=last_dol_ss.iloc[-1], color="green", linestyle="--", alpha=0.5, label="DOL SSL")

    # Title with stats
    n_buy = int(df["buy"].sum())
    n_sell = int(df["sell"].sum())
    n_sweep = int(df["sweep_ssl"].sum() + df["sweep_bsl"].sum())
    n_mss = int(df["mss_bull"].sum() + df["mss_bear"].sum())
    n_ifvg = int(df["ifvg_bull"].sum() + df["ifvg_bear"].sum())
    last_bias = df["htf_bias"].iloc[-1]
    ax.set_title(f"YKP SRI ICT Silver Bullet — XAUUSD M15\n"
                 f"BUY={n_buy} SELL={n_sell} | sweeps={n_sweep} mss={n_mss} ifvg={n_ifvg} | HTF={last_bias}",
                 fontsize=11)

    fig.savefig(out_path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return n_buy, n_sell, n_sweep, n_mss, n_ifvg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bars", type=int, default=1500)
    ap.add_argument("--tf", default="15m")
    ap.add_argument("--htf", default="4h")
    ap.add_argument("--corr", default="EURUSDT")
    ap.add_argument("--out", default="out.png")
    ap.add_argument("--symbol", default="XAUUSDT")
    args = ap.parse_args()

    print(f"Fetching {args.symbol} {args.tf} ({args.bars} bars) + HTF {args.htf} + corr {args.corr}...", flush=True)
    try:
        df = fetch_klines(args.symbol, args.tf, args.bars)
        df_htf = fetch_klines(args.symbol, args.htf, 500)
        df_corr = fetch_klines(args.corr, args.tf, args.bars)
    except Exception as e:
        print(f"Binance fetch error: {e}", file=sys.stderr)
        print("Falling back to yfinance (GC=F, EURUSD=X)...", file=sys.stderr)
        args.symbol = "GC=F"
        args.corr = "EURUSD=X"
        df = fetch_yf(args.symbol, args.tf, args.bars)
        df_htf = fetch_yf(args.symbol, args.htf, 500)
        df_corr = fetch_yf(args.corr, args.tf, args.bars)

    print(f"Got {len(df)} M15 / {len(df_htf)} H4 / {len(df_corr)} corr bars", flush=True)
    print("Simulating...", flush=True)
    df, bf, sf = simulate(df, df_htf, df_corr)

    n_buy, n_sell, n_sweep, n_mss, n_ifvg = render(df, bf, sf, args.out)
    print(f"\n=== RESULT ===", flush=True)
    print(f"BUY signals:  {n_buy}", flush=True)
    print(f"SELL signals: {n_sell}", flush=True)
    print(f"Sweeps: {n_sweep} | MSS: {n_mss} | IFVG: {n_ifvg}", flush=True)
    print(f"HTF bias final: {df['htf_bias'].iloc[-1]}", flush=True)
    print(f"DOL BSL/SSL: {df['dol_buyside'].dropna().iloc[-1] if len(df['dol_buyside'].dropna()) else 'NA'} / {df['dol_sellside'].dropna().iloc[-1] if len(df['dol_sellside'].dropna()) else 'NA'}", flush=True)
    print(f"\nChart saved: {args.out}", flush=True)

    # also dump full diagnostic CSV
    sigs = df.copy()
    sigs = sigs[["open", "high", "low", "close", "htf_bias", "dol_buyside", "dol_sellside", "last_sh", "last_sl",
                 "sweep_ssl", "sweep_bsl", "mss_bull", "mss_bear", "ifvg_bull", "ifvg_bear", "smt_bull", "smt_bear",
                 "buy", "sell", "sb_session", "bars_since_sweep_ssl", "bars_since_sweep_bsl",
                 "bars_since_mss_bull", "bars_since_mss_bear"]]
    sigs.to_csv(args.out.replace(".png", "_signals.csv"))
    print(f"Full log: {args.out.replace('.png','_signals.csv')}", flush=True)

    # show first/last DOL values, last pivot high/low
    print(f"\n=== DOL ANALYSIS ===", flush=True)
    print(f"DOL BSL last 5: {df['dol_buyside'].dropna().tail(5).tolist()}", flush=True)
    print(f"DOL SSL last 5: {df['dol_sellside'].dropna().tail(5).tolist()}", flush=True)
    print(f"Last Swing High (M15): {df['last_sh'].dropna().iloc[-1] if len(df['last_sh'].dropna()) else 'NA'}", flush=True)
    print(f"Last Swing Low  (M15): {df['last_sl'].dropna().iloc[-1] if len(df['last_sl'].dropna()) else 'NA'}", flush=True)
    print(f"HTF H4 pivots high: {int((~np.isnan(df['ph_htf'].dropna().unique())).sum()) if 'ph_htf' in df.columns else 'NA'}", flush=True)
    print(f"HTF H4 pivots low:  {int((~np.isnan(df['pl_htf'].dropna().unique())).sum()) if 'pl_htf' in df.columns else 'NA'}", flush=True)


if __name__ == "__main__":
    main()