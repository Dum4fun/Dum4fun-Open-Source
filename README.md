# Solana Token Tools - Open Source

Complete toolkit for Solana tokens: real-time event monitoring and automated trading.

## 🚀 Features

### 📡 Event Decoder
- ✅ Real-time blockchain event monitoring
- ✅ Decode pool creation, trades, phase changes
- ✅ EventEmitter interface for easy integration
- ✅ No database dependencies

### 💰 Trading Bot
- ✅ Buy/sell tokens with private key
- ✅ Automatic pool address discovery via PDA
- ✅ Support for hex and base58 key formats
- ✅ Retry logic for transaction reliability

## 📦 Installation

```bash
npm install @solana/web3.js @solana/spl-token bs58
```

## 🎯 Quick Start

### Event Decoder - Monitor Events

```javascript
const TokenEventDecoder = require('./event-decoder');

const decoder = new TokenEventDecoder('https://api.mainnet-beta.solana.com');

decoder.on('POOL_CREATED', (event) => {
  console.log('New token:', event.data.symbol);
  console.log('Market Cap:', event.data.marketCapSOL);
});

decoder.on('TRADE', (event) => {
  const { isBuy, solAmount, trader } = event.data;
  console.log(`${isBuy ? 'Buy' : 'Sell'}: ${solAmount} SOL`);
});

decoder.start();
```

### Trading Bot - Automated Trading

```javascript
const TokenTrader = require('./trade');

const trader = new TokenTrader(
  'https://api.mainnet-beta.solana.com',
  'YOUR_PRIVATE_KEY'
);

// Buy for 0.1 SOL
await trader.buy('MINT_ADDRESS', 0.1);

// Sell 1000 tokens
await trader.sell('MINT_ADDRESS', 1000);
```

**Command Line:**
```bash
export PRIVATE_KEY="your_hex_or_base58_key"
export MINT_ADDRESS="token_mint_address"

node trade.js buy 0.1
node trade.js sell 1000
```

## 📖 Documentation

### Event Decoder
- [Full Documentation](./DECODER_README.md)
- Events: `POOL_CREATED`, `TRADE`, `PHASE_CHANGE`
- Latency: < 1 second
- Memory usage: < 50MB

### Trading Bot
- [Full Documentation](./TRADE_README.md)
- Key formats: hex (64 chars) or base58
- **Pool address is found automatically via PDA** - only mint address needed
- Retry logic with resend every 2 seconds

## 💡 Usage Examples

### Auto-buy new tokens

```javascript
const decoder = new TokenEventDecoder(RPC_URL);
const trader = new TokenTrader(RPC_URL, PRIVATE_KEY);

decoder.on('POOL_CREATED', async (event) => {
  const { mintAddress, marketCapSOL } = event.data;
  
  if (marketCapSOL < 50) {
    console.log('New token with low market cap!');
    await trader.buy(mintAddress, 0.1);
  }
});

decoder.start();
```

### Auto-sell with profit

```javascript
const positions = new Map();

decoder.on('POOL_CREATED', async (event) => {
  const { mintAddress, marketCapSOL } = event.data;
  await trader.buy(mintAddress, 0.1);
  positions.set(mintAddress, { entry: marketCapSOL, amount: 1000 });
});

decoder.on('TRADE', async (event) => {
  const { mintAddress, marketCapSOL } = event.data;
  
  if (positions.has(mintAddress)) {
    const pos = positions.get(mintAddress);
    const profit = ((marketCapSOL - pos.entry) / pos.entry) * 100;
    
    if (profit > 50) {
      console.log(`Profit ${profit}%! Selling!`);
      await trader.sell(mintAddress, pos.amount);
      positions.delete(mintAddress);
    }
  }
});
```

### Monitor specific token

```javascript
const TARGET_MINT = 'YOUR_TOKEN_ADDRESS';

decoder.on('TRADE', (event) => {
  if (event.data.mintAddress === TARGET_MINT) {
    console.log('Trade:', {
      type: event.data.isBuy ? 'BUY' : 'SELL',
      sol: event.data.solAmount,
      tokens: event.data.tokenAmount,
      mcap: event.data.marketCapSOL
    });
  }
});
```

## 🔧 How Pool Address Works

Pool address **does not need to be specified manually** - it's found automatically:

```javascript
// Automatic discovery via PDA
const [poolAddress] = PublicKey.findProgramAddressSync(
  [Buffer.from('bonding_curve'), mint.toBuffer()],
  PROGRAM_ID
);
```

**For trading you only need:**
1. ✅ Private key (hex or base58)
2. ✅ Token mint address

Everything else (pool, ATA, creator) is found automatically!

## 📊 Decoder Events

### POOL_CREATED
```javascript
{
  type: 'POOL_CREATED',
  data: {
    mint: '...',
    poolAddress: '...',
    symbol: 'TOKEN',
    marketCapSOL: 20.5,
    pricePerToken: 0.000001
  }
}
```

### TRADE
```javascript
{
  type: 'TRADE',
  data: {
    trader: '...',
    mintAddress: '...',
    isBuy: true,
    solAmount: 0.5,
    tokenAmount: 1000,
    marketCapSOL: 25.3,
    phase: 'BC'
  }
}
```

### PHASE_CHANGE
```javascript
{
  type: 'PHASE_CHANGE',
  data: {
    mintAddress: '...',
    oldPhase: 'BC',
    newPhase: 'AMM'
  }
}
```

## 🔐 Security

⚠️ **IMPORTANT:**

1. Never publish your private key
2. Use `.env` files (add to `.gitignore`)
3. Use separate wallet for production
4. Store keys in secure storage

```bash
# .env file
RPC_URL=https://api.mainnet-beta.solana.com
PRIVATE_KEY=your_key_here
MINT_ADDRESS=token_mint_here
```

## ⚡ Performance

**Event Decoder:**
- Latency: < 1 second from blockchain
- Throughput: thousands of events/sec
- Memory: < 50MB
- CPU: minimal usage

**Trading Bot:**
- Speed: < 2 seconds per transaction
- Retry: resend every 2 seconds
- Confirmation: 'confirmed' level

## 🛠️ API Reference

### TokenEventDecoder

```javascript
const decoder = new TokenEventDecoder(rpcUrl);

await decoder.start();
await decoder.stop();
decoder.on(eventType, callback);
```

### TokenTrader

```javascript
const trader = new TokenTrader(rpcUrl, privateKey);

await trader.buy(mintAddress, solAmount);
await trader.sell(mintAddress, tokenAmount);
await trader.getTokenBalance(mintAddress);
await trader.getSolBalance();
```

## 📝 Configuration Examples

### Mainnet
```javascript
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = '2w6PMUmTbdyiSRo9RRXxugUMWNYcyT67icEg9wjGSrND';
const FEE_RECEIVER = '4funijKNacePEenVnhCVrRL68Brq7x2VAgefPX6UNPiw';
```

### Devnet
```javascript
const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = 'Be8wb5vRrkuhamCePNPEiuD6o8n7GqDekxsvaergwYXz';
const FEE_RECEIVER = 'ForgedAdCuHxFq6Z5Y7mFNfPiUf8F8bPG6UxAUUpts5m';
```

## 🤝 Contributing

This is an open-source project, contributions are welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - use freely in your projects

## ⚠️ Disclaimer

**Use at your own risk.** Cryptocurrency trading carries financial risks. Authors are not responsible for financial losses.

---

**Built with ❤️ for the Solana community**

GitHub: https://github.com/Dum4fun/Dum4fun-Open-Source