#!/bin/sh
# Manually refresh Leviathan API fixtures (same as the GitHub Action does on cron).
set -e
cd "$(dirname "$0")"
curl -sf --max-time 30 "https://api.leviathannews.xyz/api/v1/news/?sort_type=hot&sort_timeframe=7&limit=12" -o news.json
curl -sf --max-time 30 "https://api.leviathannews.xyz/api/v1/leaderboards/rotating/" -o leaderboards.json
curl -sf --max-time 30 "https://api.leviathannews.xyz/api/v1/intel/trending/?hours=24&top_n=15" -o trending.json
echo "fixtures refreshed: $(date -u +%FT%TZ)"
