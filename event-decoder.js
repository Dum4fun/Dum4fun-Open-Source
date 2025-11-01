const { Connection, PublicKey } = require('@solana/web3.js');
const EventEmitter = require('events');

const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = '2w6PMUmTbdyiSRo9RRXxugUMWNYcyT67icEg9wjGSrND';
const SOL_DECIMALS = 1e9;
const TOKEN_DECIMALS = 1e6;
const BC_TOTAL_SUPPLY = 1_000_000_000_000_000;
const TOTAL_SUPPLY_FOR_MARKET_CAP = 1_000_000_000;

class TokenEventDecoder extends EventEmitter {
  constructor(rpcUrl) {
    super();
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = new PublicKey(PROGRAM_ID);
    this.subscriptionId = null;
  }

  async start() {
    console.log('🚀 Starting event decoder...');
    console.log(`🔍 Program: ${this.programId.toString()}`);

    this.subscriptionId = this.connection.onLogs(
      this.programId,
      (logs, context) => {
        try {
          this.handleLogs(logs, context);
        } catch (error) {
          console.error('❌ Error handling logs:', error);
        }
      },
      'confirmed'
    );

    console.log('✅ Decoder started successfully');
  }

  handleLogs(logs, context) {
    const signature = logs.signature;
    const slot = context.slot;

    for (const log of logs.logs) {
      if (log.includes('Program data:')) {
        const base64Data = this.extractBase64Data(log);
        if (base64Data) {
          const event = this.decodeEvent(base64Data, signature, slot);
          if (event) {
            this.emitEvent(event);
          }
        }
      }
    }
  }

  extractBase64Data(log) {
    const match = log.match(/Program data: ([A-Za-z0-9+/=]+)/);
    return match ? match[1] : null;
  }

  decodeEvent(base64Data, signature, slot) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length === 0) return null;

      const eventType = buffer[0];
      const offset = { value: 1 };

      switch (eventType) {
        case 0:
          return this.decodePoolCreated(buffer, offset, signature, slot);
        case 1:
          return this.decodeTrade(buffer, offset, signature, slot);
        case 4:
          return this.decodePhaseChange(buffer, offset, signature, slot);
        default:
          return null;
      }
    } catch (error) {
      console.error('❌ Decode error:', error);
      return null;
    }
  }

  decodePoolCreated(buffer, offset, signature, slot) {
    const mint = this.readPubkey(buffer, offset);
    const creator = this.readPubkey(buffer, offset);
    const name = this.readString(buffer, offset);
    const symbol = this.readString(buffer, offset);
    const uri = this.readString(buffer, offset);
    const mode = buffer[offset.value++];
    const initialBuy = this.readU64(buffer, offset);
    const totalSupply = this.readU64(buffer, offset);

    let virtualSol = mode === 1 ? 75000000000 : 20000000000;
    let virtualTokens = BC_TOTAL_SUPPLY;

    if (offset.value + 8 <= buffer.length) virtualSol = this.readU64(buffer, offset);
    if (offset.value + 8 <= buffer.length) virtualTokens = this.readU64(buffer, offset);

    const marketCapData = this.calculateMarketCap(0, virtualTokens, 0);
    const poolAddress = this.getPoolPda(mint);

    return {
      type: 'POOL_CREATED',
      signature,
      slot,
      data: {
        mint,
        poolAddress,
        creator,
        name,
        symbol,
        uri,
        mode,
        initialBuy,
        totalSupply,
        virtualSol,
        virtualTokens,
        marketCapSOL: marketCapData.marketCapSOL,
        marketCapUSD: 0,
        circulatingSupply: marketCapData.totalSupply,
        pricePerToken: marketCapData.pricePerToken,
        timestamp: Date.now()
      }
    };
  }

  decodeTrade(buffer, offset, signature, slot) {
    const trader = this.readPubkey(buffer, offset);
    const mint = this.readPubkey(buffer, offset);
    const isBuyByte = buffer[offset.value++];
    const isBuy = isBuyByte === 1;

    let solAmount, tokenAmount;
    if (isBuy) {
      solAmount = this.readU64(buffer, offset);
      tokenAmount = this.readU64(buffer, offset);
    } else {
      tokenAmount = this.readU64(buffer, offset);
      solAmount = this.readU64(buffer, offset);
    }

    const phase = buffer[offset.value++];
    const currentPrice = this.readU64(buffer, offset);
    const tokenReserves = this.readU64(buffer, offset);
    const solReserves = this.readU64(buffer, offset);

    const marketCapData = this.calculateMarketCap(phase, tokenReserves, solReserves);
    const poolAddress = this.getPoolPda(mint);

    return {
      type: 'TRADE',
      signature,
      slot,
      data: {
        poolAddress,
        mintAddress: mint,
        trader,
        isBuy,
        solAmount: solAmount / SOL_DECIMALS,
        tokenAmount: tokenAmount / TOKEN_DECIMALS,
        pricePerToken: marketCapData.pricePerToken,
        marketCapSOL: marketCapData.marketCapSOL,
        marketCapUSD: 0,
        circulatingSupply: marketCapData.totalSupply,
        phase: phase === 0 ? 'BC' : 'AMM',
        tokenReserves: tokenReserves / TOKEN_DECIMALS,
        solReserves: solReserves / SOL_DECIMALS,
        timestamp: Date.now()
      }
    };
  }

  decodePhaseChange(buffer, offset, signature, slot) {
    const mint = this.readPubkey(buffer, offset);
    const oldPhase = buffer[offset.value++] === 0 ? 'BC' : 'AMM';
    const newPhase = buffer[offset.value++] === 0 ? 'BC' : 'AMM';
    const thresholdAmount = this.readU64(buffer, offset);
    const poolAddress = this.getPoolPda(mint);

    return {
      type: 'PHASE_CHANGE',
      signature,
      slot,
      data: {
        mint,
        poolAddress,
        oldPhase,
        newPhase,
        thresholdAmount,
        timestamp: Date.now()
      }
    };
  }

  readString(buffer, offset) {
    const length = buffer[offset.value++];
    const str = buffer.slice(offset.value, offset.value + length).toString('utf8');
    offset.value += length;
    return str;
  }

  readPubkey(buffer, offset) {
    const pubkey = new PublicKey(buffer.slice(offset.value, offset.value + 32)).toString();
    offset.value += 32;
    return pubkey;
  }

  readU64(buffer, offset) {
    const value = Number(buffer.readBigUInt64LE(offset.value));
    offset.value += 8;
    return value;
  }

  getPoolPda(mint) {
    try {
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding_curve"), new PublicKey(mint).toBytes()],
        new PublicKey(PROGRAM_ID)
      );
      return poolPda.toString();
    } catch {
      return 'ERROR';
    }
  }

  calculatePrice(phase, tokenReserves, solReserves) {
    const BC_K_CONST = 20_000_000_000 * 1_000_000_000;
    const AMM_K_CONST = 36_000_000_000 * 450_000_000;

    if (phase === 0) {
      const tokenReservesRaw = tokenReserves / TOKEN_DECIMALS;
      if (tokenReservesRaw <= 0) return 0;
      const currentVirtualSol = BC_K_CONST / tokenReservesRaw;
      const pricePerRawToken = currentVirtualSol / tokenReservesRaw;
      return pricePerRawToken / SOL_DECIMALS;
    } else {
      if (!solReserves || solReserves <= 0) return 0;
      const virtualTokensRaw = AMM_K_CONST / solReserves;
      const pricePerRawToken = solReserves / virtualTokensRaw;
      return pricePerRawToken / SOL_DECIMALS;
    }
  }

  calculateMarketCap(phase, tokenReserves, solReserves) {
    const pricePerToken = this.calculatePrice(phase, tokenReserves, solReserves);
    const marketCapSOL = pricePerToken * TOTAL_SUPPLY_FOR_MARKET_CAP;
    return {
      marketCapSOL: marketCapSOL,
      pricePerToken: pricePerToken,
      totalSupply: TOTAL_SUPPLY_FOR_MARKET_CAP,
      phase: phase === 0 ? 'BC' : 'AMM'
    };
  }

  emitEvent(event) {
    console.log(`\n📢 Event: ${event.type}`);
    console.log(`🔗 Signature: ${event.signature}`);
    console.log(`📦 Data:`, JSON.stringify(event.data, (key, value) => {
      if (typeof value === 'number' && value < 0.0001 && value > 0) {
        return value.toFixed(10);
      }
      return value;
    }, 2));

    this.emit('event', event);
    this.emit(event.type, event);
  }

  async stop() {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
      console.log('🛑 Decoder stopped');
    }
  }
}

if (require.main === module) {
  const decoder = new TokenEventDecoder(RPC_URL);

  decoder.on('POOL_CREATED', (event) => {
    const p = event.data;
    console.log(`🎉 New pool created: ${p.symbol} (${p.name})`);
    console.log(`   Mint: ${p.mint}`);
    console.log(`   Creator: ${p.creator}`);
    console.log(`   Market Cap: ${p.marketCapSOL.toFixed(2)} SOL`);
    console.log(`   Price: ${p.pricePerToken.toFixed(10)} SOL`);
  });

  decoder.on('TRADE', (event) => {
    const t = event.data;
    const action = t.isBuy ? 'BUY' : 'SELL';
    console.log(`💰 ${action}: ${t.solAmount.toFixed(4)} SOL for ${t.tokenAmount.toFixed(0)} tokens`);
    console.log(`   Market Cap: ${t.marketCapSOL.toFixed(2)} SOL | Price: ${t.pricePerToken.toFixed(10)} SOL`);
  });

  decoder.on('PHASE_CHANGE', (event) => {
    const p = event.data;
    console.log(`🔄 Phase change: ${p.oldPhase} → ${p.newPhase}`);
    console.log(`   Mint: ${p.mint}`);
    console.log(`   Threshold: ${(p.thresholdAmount / SOL_DECIMALS).toFixed(2)} SOL`);
  });

  decoder.start();

  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    await decoder.stop();
    process.exit(0);
  });
}

module.exports = TokenEventDecoder;