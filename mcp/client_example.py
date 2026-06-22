"""
mcp/client_example.py — minimal MCP client that connects to the Compagnon
producer server over stdio and calls both tools. Proves the MCP connection works.

Run (after `pip install -r requirements.txt`):
    python mcp/client_example.py
"""
import asyncio
import os
import sys


async def main():
    try:
        from fastmcp import Client
    except Exception:
        print("fastmcp not installed. Run: pip install -r requirements.txt")
        sys.exit(0)

    server_path = os.path.join(os.path.dirname(__file__), "producer_server.py")
    # FastMCP can spawn a stdio server directly from the script path.
    async with Client(server_path) as client:
        tools = await client.list_tools()
        print("Connected. Tools exposed by the MCP server:")
        for t in tools:
            print(f"  - {t.name}: {t.description.splitlines()[0]}")

        print("\nlist_producers(max_km=15):")
        res = await client.call_tool("list_producers", {"max_km": 15})
        print(" ", res.data if hasattr(res, "data") else res)

        print("\nbasket_for(['eggs','spinach','sourdough']):")
        res = await client.call_tool("basket_for",
                                     {"items": ["eggs", "spinach", "sourdough"], "max_km": 15})
        print(" ", res.data if hasattr(res, "data") else res)


if __name__ == "__main__":
    asyncio.run(main())
