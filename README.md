<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Polymarket Trading Service - A NestJS-based application for integrating with Polymarket prediction markets. This service provides APIs for managing events, markets, and orders with queue-based execution, idempotency, and transactional safety.

> **Design Decisions**: For detailed information about my implementation checkout [DESIGN.md](./DESIGN.md).

## Features

- Event and Market synchronization with Polymarket
- Queue-based order processing with BullMQ
- Idempotent order creation and cancellation
- Transactional safety and optimistic locking
- Comprehensive test coverage (unit and e2e)
- Real-time WebSocket integration for live market updates

## Test Coverage

![Coverage - Statements](https://img.shields.io/badge/statements-83.29%25-yellow.svg)
![Coverage - Branches](https://img.shields.io/badge/branches-67.85%25-red.svg)
![Coverage - Functions](https://img.shields.io/badge/functions-88.14%25-yellow.svg)
![Coverage - Lines](https://img.shields.io/badge/lines-82.94%25-yellow.svg)

Current test coverage metrics:
- **Statements**: 83.29% (342 tests passing across 35 test suites)
- **Branches**: 67.85%
- **Functions**: 88.14%
- **Lines**: 82.94%

**Key Coverage Highlights:**
- 100% coverage: `message-utils`, `signature-validation.service`, `token.repository`, `common/utils`, `common/services`
- 95%+ coverage: `database/repositories` (95.49%)
- 91%+ coverage: `market-update-handler.service` (91.77%)
- 88%+ coverage: `polymarket-websocket.service` (88.19%)

To view the detailed HTML coverage report:
1. Run `pnpm test:cov` to generate the coverage report
2. Open `coverage/lcov-report/index.html` in your browser

## Project setup

```bash
$ pnpm install
```

## Environment Setup

Copy the example environment file and configure your settings:

```bash
$ cp .env.example .env
```

### Required Services

- PostgreSQL database
- Redis server (for BullMQ)

### Database Setup

Run migrations to set up the database schema:

```bash
$ pnpm run migration:run
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod

# run scheduler/worker
$ pnpm run start:scheduler
```

## Run tests

```bash
# unit tests
$ pnpm run test

# unit tests in watch mode
$ pnpm run test:watch

# e2e tests
$ pnpm run test:e2e

# test coverage (generates HTML report in coverage/lcov-report/index.html)
$ pnpm run test:cov
```

After running `pnpm run test:cov`, you can view the detailed HTML coverage report by opening `coverage/lcov-report/index.html` in your browser.

## E2E Testing

The application includes comprehensive end-to-end tests for all API endpoints.

### Test Setup

E2E tests require a running PostgreSQL database and Redis instance. Make sure your `.env` file is properly configured with test database credentials.

### Running E2E Tests

```bash
# Run all e2e tests
$ pnpm run test:e2e

# Run specific e2e test file
$ pnpm run test:e2e -- events.e2e-spec.ts
```

### Test Coverage

The project has **342 passing tests** across **35 test suites**, including:

**Unit Tests:**
- Service layer tests (events, markets, orders, sync)
- Repository layer tests
- Provider integration tests (Polymarket WebSocket, CLOB, HTTP)
- Utility and factory tests
- Interceptor and filter tests

**E2E Tests cover:**
- **Events API**: GET /events, GET /events/:id, POST /events/sync
- **Markets API**: GET /markets, GET /markets/:id with various filters
- **Orders API**: POST /orders (with idempotency), GET /orders, GET /orders/:id, DELETE /orders/:id

### Test Structure

- `test/utils/test-app.factory.ts` - Application bootstrapping for tests
- `test/utils/test-db.helper.ts` - Database cleanup and transaction helpers
- `test/utils/test-data.factory.ts` - Test data generators
- `test/*.e2e-spec.ts` - E2E test suites for each module

### Database Cleanup

Tests automatically clean the database before each test case to ensure isolation and consistency.

## Polymarket Integration

This service integrates with Polymarket's APIs for fetching events, markets, and placing orders.

### Polymarket APIs Used

**Gamma API** (`https://gamma-api.polymarket.com`):
- `GET /events` - Fetch events list
- `GET /events/:eventId` - Get event details with markets

**CLOB API** (`https://clob.polymarket.com`):
- Uses `@polymarket/clob-client` package
- Market data, order placement, order book operations
- Methods: `getMarkets()`, `getMarket()`, `getOrderBook()`, `getPrice()`, `getMidpoint()`, `placeOrder()`, `getOpenOrders()`, `getTrades()`

**WebSocket API** (`wss://ws-subscriptions-clob.polymarket.com`):
- Real-time market price updates
- Market creation notifications

### Mock vs Live Trading

- **Mock Mode** (default): When `POLYMARKET_ENABLE_REAL_TRADING=false` or not set
  - Orders are simulated without actual blockchain transactions
  - Mock adapter located at `__mocks__/@polymarket/clob-client.ts` used in tests
- **Live Mode**: When `POLYMARKET_ENABLE_REAL_TRADING=true`
  - Real orders placed via CLOB API
  - Requires wallet private key and funder address configuration
  - USDC transfers and approvals handled automatically

## API Documentation

The API documentation is automatically generated using Swagger/OpenAPI and is available at:

**Production**: https://poylmarket-trader.brimble.app/api/docs

**Local Development**: http://localhost:3000/api/docs

The Swagger documentation is generated from code annotations, ensuring it stays in sync with the implementation. All endpoints, request/response DTOs, and authentication requirements are documented with examples and schemas.
