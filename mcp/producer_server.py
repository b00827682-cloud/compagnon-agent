"""
mcp/producer_server.py — a real MCP server (FastMCP) wrapping Compagnon's
local-producer lookup, the external data source the replenishment agent uses.

This satisfies Deliverable 3 (MCP server, built with FastMCP). The producer data
mirrors the PRODUCERS list in app/compagnon.html, so the MCP server and the app
expose the same catalogue.

Run the server:
    pip install -r requirements.txt
    python mcp/producer_server.py            # serves over stdio (MCP default)

Permissions / scopes / limits (declared, per the brief):
    - read-only: exposes lookup tools only; no write/order endpoints here
      (placing an order stays in the guarded agent, never in the MCP server)
    - scope: local producers within `max_km` of the household
    - rate limit: soft cap of 60 calls/min enforced by the caller; the server
      itself is stateless and cheap

A client example is in mcp/client_example.py.
"""
from __future__ import annotations

# Producer catalogue — mirrors PRODUCERS in app/compagnon.html (~line 172).
PRODUCERS = [
    {"item": "Avoine de Brie oat milk", "producer": "Biocoop Meaux", "dist": 14, "price": 2.40, "co2": 0.7, "super": 1.2},
    {"item": "Free-range eggs (×6)", "producer": "Ferme du Tarteret", "dist": 6, "price": 2.10, "co2": 0.7, "super": 0.9},
    {"item": "Baby spinach", "producer": "AMAP de la Marne", "dist": 11, "price": 1.80, "co2": 0.2, "super": 0.4},
    {"item": "Carrots (1 kg)", "producer": "AMAP de la Marne", "dist": 11, "price": 1.50, "co2": 0.4, "super": 0.7},
    {"item": "Sourdough loaf", "producer": "Fournil de la Ferté", "dist": 3, "price": 3.20, "co2": 0.6, "super": 0.8},
]

try:
    from fastmcp import FastMCP
except Exception:  # pragma: no cover - allows import without the dep installed
    FastMCP = None


def _list_producers(max_km: float = 15.0) -> list[dict]:
    return [p for p in PRODUCERS if p["dist"] <= max_km]


def _basket_for(items: list[str], max_km: float = 15.0) -> dict:
    chosen = [p for p in PRODUCERS if p["dist"] <= max_km and any(
        i.lower() in p["item"].lower() or p["item"].lower().split()[0] in i.lower() for i in items)]
    total = round(sum(p["price"] for p in chosen), 2)
    co2_saved = round(sum(p["super"] - p["co2"] for p in chosen), 2)
    return {"items": chosen, "total_price": total, "co2_saved_kg": co2_saved,
            "within_km": max_km, "count": len(chosen)}


if FastMCP is not None:
    mcp = FastMCP("compagnon-producers")

    @mcp.tool()
    def list_producers(max_km: float = 15.0) -> list[dict]:
        """List local producers within max_km of the household (read-only)."""
        return _list_producers(max_km)

    @mcp.tool()
    def basket_for(items: list[str], max_km: float = 15.0) -> dict:
        """Build a candidate replenishment basket for the requested items from
        local producers within max_km. Returns total price and CO2 saved vs
        supermarket. Does NOT place an order — ordering stays in the guarded agent."""
        return _basket_for(items, max_km)

    if __name__ == "__main__":
        mcp.run()  # stdio transport by default
else:
    if __name__ == "__main__":
        # Fallback so the file runs even without fastmcp installed: show the data.
        import json
        print("fastmcp not installed; install with: pip install -r requirements.txt")
        print("Producers within 15 km:")
        print(json.dumps(_list_producers(), indent=2, ensure_ascii=False))
