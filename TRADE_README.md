# Token Trading Bot - Open Source

Automated token trading on Solana using private keys.

## Installation

```bash
npm install @solana/web3.js @solana/spl-token bs58
```

## Quick Start

### 1. Setup Environment Variables

```bash
export RPC_URL="https://api.mainnet-beta.solana.com"
export PRIVATE_KEY="your_private_key_hex_or_base58"
export MINT_ADDRESS="token_mint_address"
```

### 2. Command Line Usage

```bash
# Buy for 0.1 SOL
node trade.js buy 0.1

# Sell 1000 tokens
node trade.js sell 1000
```

## Code Usage

### Buy Tokens

```javascript
const TokenTrader = require('./trade');

const trader = new TokenTrader(
  'https://api.mainnet-beta.solana.com',
  'YOUR_PRIVATE_KEY'
);

await trader.buy(
  'MINT_ADDRESS',
  0.1
);
```

### Sell Tokens

```javascript
await trader.sell(
  'MINT_ADDRESS',
  1000
);
```

### Check Balances

```javascript
const solBalance = await trader.getSolBalance();
console.log(`SOL: ${solBalance}`);

const tokenBalance = await trader.getTokenBalance('MINT_ADDRESS');
console.log(`Tokens: ${tokenBalance}`);
```

## API

### Constructor

```javascript
new TokenTrader(rpcUrl, privateKey)
```

**Parameters:**
- `rpcUrl` - Solana RPC endpoint
- `privateKey` - Hex (64 chars) or Base58 private key

### Methods

#### `buy(mintAddress, solAmount)`

Buy tokens with SOL.

**Parameters:**
- `mintAddress` - token address
- `solAmount` - SOL amount

**Returns:**
```javascript
{
  signature: 'transaction_signature',
  success: true
}
```

#### `sell(mintAddress, tokenAmount)`

Sell tokens for SOL.

**Parameters:**
- `mintAddress` - token address
- `tokenAmount` - token amount

#### `getTokenBalance(mintAddress)`

Get token balance.

#### `getSolBalance()`

Get SOL balance.

## Examples

### Simple Trading Bot

```javascript
const TokenTrader = require('./trade');

const trader = new TokenTrader(RPC_URL, PRIVATE_KEY);
const MINT = 'YOUR_MINT_ADDRESS';

async function tradingLoop() {
  const balance = await trader.getTokenBalance(MINT);
  
  if (balance === 0) {
    console.log('Buying...');
    await trader.buy(MINT, 0.1);
  } else if (balance > 1000) {
    console.log('Selling...');
    await trader.sell(MINT, balance);
  }
  
  setTimeout(tradingLoop, 10000);
}

tradingLoop();
```

### Integration with Event Decoder

```javascript
const TokenEventDecoder = require('./event-decoder');
const TokenTrader = require('./trade');

const decoder = new TokenEventDecoder(RPC_URL);
const trader = new TokenTrader(RPC_URL, PRIVATE_KEY);

decoder.on('POOL_CREATED', async (event) => {
  const { mintAddress, marketCapSOL } = event.data;
  
  if (marketCapSOL < 50) {
    console.log('New token with low mcap, buying!');
    await trader.buy(mintAddress, 0.1);
  }
});

decoder.start();
```

### Auto-sell with Profit

```javascript
const positions = new Map();

decoder.on('TRADE', async (event) => {
  const { mintAddress, marketCapSOL, isBuy } = event.data;
  
  if (isBuy && positions.has(mintAddress)) {
    const entry = positions.get(mintAddress);
    const profitPercent = ((marketCapSOL - entry.mcap) / entry.mcap) * 100;
    
    if (profitPercent > 50) {
      console.log(`Profit ${profitPercent}%, selling!`);
      await trader.sell(mintAddress, entry.amount);
      positions.delete(mintAddress);
    }
  }
});
```

## Private Key Format

Two formats are supported:

### Hex (64 characters)
```
1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### Base58 (Phantom/Solflare export)
```
5Kbb8b...your_key...xyz
```

## Security

⚠️ **IMPORTANT:**

- Never share your private key
- Use `.env` files (add to `.gitignore`)
- Use separate wallet for production
- Store keys in secure storage

## Transaction Settings

```javascript
ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 })
ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 })
```

- **Compute Units:** 200,000 (maximum compute resources)
- **Priority Fee:** 5,000 microLamports (transaction priority)

Increase priority fee for faster confirmation:
```javascript
tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));
```

## Error Handling

```javascript
try {
  await trader.buy(MINT, 0.1);
} catch (error) {
  if (error.message.includes('insufficient funds')) {
    console.log('Insufficient SOL');
  } else if (error.message.includes('Pool not found')) {
    console.log('Token not yet created');
  } else {
    console.error('Error:', error.message);
  }
}
```

## Performance

- **Execution speed:** < 2 seconds
- **Retry logic:** automatic resend every 2 seconds
- **Confirmation:** 'confirmed' level (balance of speed/reliability)

## Compatibility

- ✅ Solana mainnet-beta
- ✅ TOKEN_2022_PROGRAM_ID
- ✅ Works with bonding curve pools
- ✅ Automatic ATA creation

## License

MIT License

---

**⚠️ Use at your own risk. Cryptocurrency trading carries financial risks.**