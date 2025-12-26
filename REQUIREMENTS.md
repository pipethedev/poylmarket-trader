### Short Technical Test — Polymarket Integration (backend-first)

### **Goal**

build a small NestJS service (TypeScript) that integrates with Polymarket and proves you can fetch events/markets, place and cancel orders, and reliably process execution via a queue. Read Polymarket’s docs first: [https://docs.polymarket.com](https://docs.polymarket.com/)  the task is straightforward but should show how you handle queues, integration, error/retry logic, idempotency, and state modeling for prediction markets.

### **What to implement**

1. A minimal NestJS app with the following APIs:
    1. GET /events — fetch and return a list of events from Polymarket
    2. GET /events/:eventId/markets — list markets for a given event.
    3. POST /orders — create an order: { type: 'market'|'limit'}
    4. POST /orders/:orderId/cancel — cancel an existing order.
2. Queue-based execution:
    1. Enqueue every create-order request to a worker queue (Redis BullMQ)
    2. Worker picks up the job, interacts with Polymarket APIs to submit the trade (or simulates an on-chain call if necessary), and updates order state.
    3. Ensure robust retry/backoff and idempotency so duplicated jobs or concurrent workers don’t double-execute the same order.
3. Persistence & concurrency:
    1. Use Postgres (or an equivalent SQL DB) for order and market state. Model orders so they can only be executed/cancelled once.
    2. Demonstrate transactional safety / locking where needed to avoid race conditions (e.g., two workers trying to execute or cancel the same order simultaneously).
4. Tests & demo:
    1. Provide automated tests that cover: fetching events/markets, creating an order and seeing it executed via the queue, cancelling an order before execution, and taking a failed-to-execute path.
    2. If you can’t use a live Polymarket endpoint, provide a small mock adapter that simulates Polymarket responses; but prefer real integration where possible.

### **Prediction-market primer (so you model state correctly)**

An **Event** is the real-world occurrence being predicted (e.g., “2028 U.S. Presidential Election”). Each event can have one or more **Markets** that express a particular binary or multi-outcome question inside the event (e.g., under the “2028 U.S. Presidential Election” event you might have markets like “Who wins the general election?” and “Does candidate X exceed 50%?”). A **Market** usually exposes discrete **Tokens** (sometimes called assets); in binary markets, you typically see two tokens: *Yes* and *No*. Each token/asset has an identifier (asset ID) used by the Polymarket API to place trades. When you trade, you buy a specific token for a particular asset ID (so “buy yes token for market X” is an order for the yes asset ID). Events → Markets → Tokens is the data hierarchy to model.

### **Deliverables**

- Git repo with the NestJS app, migrations/schema, worker/queue code, and tests.
- README with instructions to run the app, run worker(s), and run tests. Include any Polymarket endpoints you used and a short note about whether you ran against a live endpoint or a mock.
- Short notes (1–2 paragraphs) describing design tradeoffs you made (queues, idempotency strategy, failure handling).
- Email your submission to [justice@useliquid.xyz](mailto:justice@useliquid.xyz) CC [njoku@useliquid.xyz](mailto:njoku@useliquid.xyz)
- This needs to be delivered within 5 days of receiving this assessment