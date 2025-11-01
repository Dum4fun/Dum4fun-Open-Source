# Token Event Decoder - Open Source

A lightweight, zero-dependency event decoder for token launchpad smart contracts on Solana.

## Features

✅ Real-time event streaming from Solana blockchain
✅ Decodes pool creation, trades, and phase changes
✅ No database dependencies
✅ Simple EventEmitter interface
✅ Production-ready

## Installation
```bash
npm install @solana/web3.js
```

## Usage

### Basic Usage
```javascript
const TokenEventDecoder = require('./event-decoder');

const decoder = new TokenEventDecoder('https://api.mainnet-beta.solana.com');

decoder.on('event', (event) => {
  console.log('Event:', event);
});

decoder.on('POOL_CREATED', (event) => {
  console.log('New pool:', event.data);
});

decoder.on('TRADE', (event) => {
  console.log('Trade:', event.data);
});

decoder.on('PHASE_CHANGE', (event) => {
  console.log('Phase change:', event.data);
});

decoder.start();
```

### Environment Variables
```bash
export RPC_URL="https://api.mainnet-beta.solana.com"
node event-decoder.js
```

## Event Types

### POOL_CREATED

Emitted when a new token pool is created.
```javascript
{
  type: 'POOL_CREATED',
  signature: 'txn_signature...',
  slot: 123456789,
  data: {
    poolAddress: 'pool_public_key',
    mintAddress: 'mint_public_key',
    creator: 'creator_public_key',
    timestamp: '2025-01-01T00:00:00.000Z'
  }
}
```

### TRADE

Emitted on every buy/sell transaction.
```javascript
{
  type: 'TRADE',
  signature: 'txn_signature...',
  slot: 123456789,
  data: {
    trader: 'trader_public_key',
    mintAddress: 'mint_public_key',
    isBuy: true,
    solAmount: 1.5,
    tokenAmount: 1000000,
    price: 0.0000015,
    tokenReserves: 500000,
    solReserves: 20.5,
    timestamp: '2025-01-01T00:00:00.000Z'
  }
}
```

### PHASE_CHANGE

Emitted when pool transitions between phases.
```javascript
{
  type: 'PHASE_CHANGE',
  signature: 'txn_signature...',
  slot: 123456789,
  data: {
    poolAddress: 'pool_public_key',
    mintAddress: 'mint_public_key',
    oldPhase: 'BC',
    newPhase: 'AMM',
    timestamp: '2025-01-01T00:00:00.000Z'
  }
}
```

## API Reference

### Constructor
```javascript
new TokenEventDecoder(rpcUrl)
```

- `rpcUrl`: Solana RPC endpoint

### Methods

#### `start()`

Starts listening to blockchain events.
```javascript
await decoder.start();
```

#### `stop()`

Stops listening and cleans up.
```javascript
await decoder.stop();
```

#### `on(event, callback)`

Subscribe to events (inherits from EventEmitter).
```javascript
decoder.on('TRADE', (event) => {
  // Handle trade event
});
```

## Examples

### Track All Trades
```javascript
const decoder = new TokenEventDecoder(rpcUrl);

decoder.on('TRADE', (event) => {
  const { isBuy, solAmount, tokenAmount, trader } = event.data;
  const action = isBuy ? 'bought' : 'sold';
  
  console.log(`${trader} ${action} ${tokenAmount} tokens for ${solAmount} SOL`);
});

decoder.start();
```

### Monitor Specific Token
```javascript
const targetMint = 'YOUR_TOKEN_MINT_ADDRESS';

decoder.on('TRADE', (event) => {
  if (event.data.mintAddress === targetMint) {
    console.log('Trade on my token:', event.data);
  }
});

decoder.start();
```

### Build Trading Bot
```javascript
decoder.on('POOL_CREATED', async (event) => {
  const { mintAddress, creator } = event.data;
  
  if (shouldBuy(mintAddress)) {
    await executeBuy(mintAddress);
  }
});

decoder.start();
```

## Architecture
```
Solana Blockchain
       ↓
   RPC Node
       ↓
  onLogs Subscribe
       ↓
Event Decoder (parses logs)
       ↓
   EventEmitter
       ↓
  Your Application
```

## Performance

- **Latency**: < 1 second from blockchain to your app
- **Throughput**: Handles thousands of events per second
- **Memory**: < 50MB typical usage
- **CPU**: Minimal - async event-driven

## Error Handling

The decoder automatically handles:
- Connection errors
- Invalid data
- Buffer overflow
- Type mismatches

All errors are logged but don't crash the process.

## Contributing

This is an open-source project. Contributions welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - use freely in your projects

## Support

- GitHub: https://github.com/Dum4fun/Dum4fun-Open-Source

---

**Built with ❤️ for the Solana community**