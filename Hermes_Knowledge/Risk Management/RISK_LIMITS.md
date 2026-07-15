# Risk Limits (enforced in orchestrator)

Source: ICT_TRADING_STRATEGY.md §8 + orchestrator RISK_LIMITS

- Min RR: 1:3
- Max risk per trade: 2% (1% if score < 90)
- Max daily loss: 5% → stop trading
- Max open trades: 3
- Score threshold: 80/100
- Full risk (A+): score ≥ 90

Hard gates before score: No Sweep, No MSS, No IFVG, News window, Kill Zone session.
