# Event Decoder - Quick Documentation

Real-time event decoder for Solana tokens.

## Quick Start

```bash
npm install @solana/web3.js
export RPC_URL="https://api.mainnet-beta.solana.com"
node event-decoder.js
```

## Usage

```javascript
const TokenEventDecoder = require('./event-decoder');

const decoder = new TokenEventDecoder(RPC_URL);

decoder.on('POOL_CREATED', (event) => {
  console.log('New token:', event.data.symbol);
  console.log('Market Cap:', event.data.marketCapSOL);
});

decoder.on('TRADE', (event) => {
  const { isBuy, solAmount, tokenAmount } = event.data;
  console.log(`${isBuy ? 'Buy' : 'Sell'}: ${solAmount} SOL`);
});

decoder.on('PHASE_CHANGE', (event) => {
  console.log(`Phase changed: ${event.data.oldPhase} → ${event.data.newPhase}`);
});

decoder.start();
```

## Events

### POOL_CREATED
New token created.
```javascript
{
  mint: '...',
  symbol: 'TOKEN',
  marketCapSOL: 20.5,
  pricePerToken: 0.000001
}
```

### TRADE
Token buy/sell.
```javascript
{
  trader: '...',
  mintAddress: '...',
  isBuy: true,
  solAmount: 0.5,
  tokenAmount: 1000
}
```

### PHASE_CHANGE
Pool phase change (BC → AMM).
```javascript
{
  oldPhase: 'BC',
  newPhase: 'AMM'
}
```

## API

### `start()`
Start decoder.

### `stop()`
Stop decoder.

### `on(event, callback)`
Subscribe to events.

Full documentation: [README.md](README.md)