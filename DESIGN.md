# Design Tradeoffs and Implementation Notes

## Architecture Decisions

### 1. Provider Pattern for Multiple Market Providers

The codebase implements a provider pattern that abstracts market data access behind a `MarketProvider` interface. This design allows the system to support multiple prediction market providers (currently Polymarket, but extensible to others like Kalshi, PredictIt, etc.) without changing core business logic. The `ProviderManagerService` handles provider selection and switching, making it straightforward to add new providers or switch between them based on availability, pricing, or business requirements. This abstraction also simplifies testing by allowing easy mocking of provider implementations.

### 2. Auto-Increment IDs vs UUIDs

I went with auto-incrementing integer IDs instead of UUIDs for primary keys. The main reason is performance, integers are way smaller (4-8 bytes vs 16 bytes for UUIDs), which makes indexing faster and foreign key lookups more efficient. The downside is that sequential IDs can reveal information about creation order, and if you ever need to merge data from multiple databases, you might run into conflicts. But for this project, the performance gains are worth it, especially when we always have to sync data in realtime. I keep `externalId` fields (strings) for provider-specific identifiers anyway. But in the past i have experienced performance issues with UUIDs before, so i decided not to over think it.

### 3. Idempotency Strategy

Idempotency is implemented using Redis: the idempotency service hashes request content and locks keys during processing, with an interceptor that validates and caches responses. This ensures that duplicate requests are handled gracefully without creating duplicate orders. The interceptor is attached to mostly idempotent requests like POST and PUT/PATCH.

### 4. Order Management and Queue Processing

All orders are pushed to a BullMQ queue for asynchronous processing. This decouples order creation from execution, allowing the API to respond quickly while orders are processed in the background. The queue is configured with 10 retry attempts and exponential backoff (starting at 5 minutes) to avoid overwhelming the system or the provider's API during outages. Before processing each order, I perform a provider health check. if the provider is down, the order throws an error and gets retried later instead of failing immediately. This approach ensures orders eventually get processed when the provider comes back online, while preventing unnecessary load during downtime.

### 5. Polling and WebSocket Hybrid Approach

I went with an hybrid approach for data synchronization: WebSocket connections provide real-time price updates and market creation notifications, while scheduled cron jobs (every 15 minutes for events, every 5 minutes for prices) serve as a fallback and ensure data consistency. The WebSocket handles high-frequency updates efficiently, while polling ensures we don't miss updates if the WebSocket disconnects or misses messages. This dual approach balances real-time responsiveness with reliability.
Luckily polymarket api had support for web sockets, so I just listen to the websocket for changes (like prices, volumes and any important information regarding the stake)

### 6. Independent Cron Job Service

The scheduler runs as a separate service (`start:scheduler` command) rather than within the main API server. This separation allows independent scaling, deployment, and failure isolation. If the API server restarts, the scheduler continues running, and vice versa. It also prevents cron jobs from blocking API request handling and allows us to run multiple scheduler instances for redundancy without duplicating the entire API server.

### 7. Factory-Based Approach for Single Responsibility

All entity creation and transformation logic is centralized in factory classes (`EventFactory`, `MarketFactory`, `TokenFactory`, `OrderFactory`). This ensures single responsibility: services handle business logic, repositories handle data access, and factories handle data transformation. Factories encapsulate the mapping between provider data models and our internal entities, making it easier to adapt to provider API changes and maintain consistent entity creation across the codebase. This pattern also simplifies testing by isolating transformation logic.

### 8. Test Coverage and Strategy

The codebase includes comprehensive test coverage: 342 tests across 35 test suites with 83%+ statement coverage. I implemented both unit tests (for services, repositories, factories, utilities) and end-to-end tests (for API endpoints, queue processing, integration scenarios). E2E tests include async queue execution verification, failure path testing, and status transition validation. The test structure uses factories for test data generation and helpers for database cleanup, ensuring tests are isolated and maintainable.

### Some attached screenshot of logs during the sync process.