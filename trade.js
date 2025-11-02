const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, ComputeBudgetProgram } = require('@solana/web3.js');
const { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');

const PROGRAM_ID = new PublicKey('2w6PMUmTbdyiSRo9RRXxugUMWNYcyT67icEg9wjGSrND');
const FEE_RECEIVER = new PublicKey('4funijKNacePEenVnhCVrRL68Brq7x2VAgefPX6UNPiw');
const LAMPORTS_PER_SOL = 1e9;
const TOKEN_DECIMALS = 1e6;

class TokenTrader {
  constructor(rpcUrl, privateKey) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.wallet = this.loadWallet(privateKey);
  }

  loadWallet(privateKey) {
    try {
      if (privateKey.length === 64) {
        return Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
      } else {
        return Keypair.fromSecretKey(bs58.decode(privateKey));
      }
    } catch (error) {
      throw new Error('Invalid private key format. Use hex or base58');
    }
  }

  encodeU64(val) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(val));
    return buffer;
  }

  encodeTradeData(amount, minOut) {
    return Buffer.concat([this.encodeU64(amount), this.encodeU64(minOut)]);
  }

  createInstruction(type, data, accounts) {
    return new TransactionInstruction({
      keys: accounts.map(({ pubkey, signer = false, writable = false }) => ({
        pubkey,
        isSigner: signer,
        isWritable: writable
      })),
      programId: PROGRAM_ID,
      data: Buffer.concat([Buffer.from([type]), data])
    });
  }

  async getCreatorFromPool(mint) {
    const [poolAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding_curve'), mint.toBuffer()],
      PROGRAM_ID
    );
    const poolAccount = await this.connection.getAccountInfo(poolAddress);
    if (!poolAccount) {
      throw new Error('Pool not found');
    }
    const creatorBytes = poolAccount.data.slice(32, 64);
    return new PublicKey(creatorBytes);
  }

  async getTradeAccounts(mint, poolAddress, poolToken, userToken) {
    const creator = await this.getCreatorFromPool(mint);
    return [
      { pubkey: this.wallet.publicKey, signer: true, writable: true },
      { pubkey: poolAddress, writable: true },
      { pubkey: mint, writable: true },
      { pubkey: poolToken, writable: true },
      { pubkey: userToken, writable: true },
      { pubkey: creator, writable: true },
      { pubkey: FEE_RECEIVER, writable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID },
      { pubkey: SystemProgram.programId }
    ];
  }

  async buy(mintAddress, solAmount) {
    const mint = new PublicKey(mintAddress);
    const solAmountLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

    const [poolAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding_curve'), mint.toBuffer()],
      PROGRAM_ID
    );

    const poolToken = getAssociatedTokenAddressSync(mint, poolAddress, true, TOKEN_2022_PROGRAM_ID);
    const userToken = getAssociatedTokenAddressSync(mint, this.wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);

    const tx = new Transaction();

    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

    const createATAIx = createAssociatedTokenAccountIdempotentInstruction(
      this.wallet.publicKey,
      userToken,
      this.wallet.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    tx.add(createATAIx);

    const buyIx = this.createInstruction(
      1,
      this.encodeTradeData(solAmountLamports, 0),
      await this.getTradeAccounts(mint, poolAddress, poolToken, userToken)
    );
    tx.add(buyIx);

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.wallet.publicKey;

    tx.sign(this.wallet);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 0
    });

    console.log(`🔄 Buy transaction sent: ${signature}`);

    const confirmPromise = this.connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight
      },
      'confirmed'
    );

    const retryInterval = setInterval(async () => {
      try {
        await this.connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: true,
          maxRetries: 0
        });
      } catch (e) {}
    }, 2000);

    try {
      const confirmation = await confirmPromise;
      clearInterval(retryInterval);

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log(`✅ Buy successful: ${signature}`);
      return { signature, success: true };
    } catch (error) {
      clearInterval(retryInterval);
      throw error;
    }
  }

  async sell(mintAddress, tokenAmount) {
    const mint = new PublicKey(mintAddress);
    const tokenAmountRaw = Math.floor(tokenAmount * TOKEN_DECIMALS);

    const [poolAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding_curve'), mint.toBuffer()],
      PROGRAM_ID
    );

    const poolToken = getAssociatedTokenAddressSync(mint, poolAddress, true, TOKEN_2022_PROGRAM_ID);
    const userToken = getAssociatedTokenAddressSync(mint, this.wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);

    const tx = new Transaction();

    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));

    const sellIx = this.createInstruction(
      2,
      this.encodeTradeData(tokenAmountRaw, 0),
      await this.getTradeAccounts(mint, poolAddress, poolToken, userToken)
    );
    tx.add(sellIx);

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.wallet.publicKey;

    tx.sign(this.wallet);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 0
    });

    console.log(`🔄 Sell transaction sent: ${signature}`);

    const confirmPromise = this.connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight
      },
      'confirmed'
    );

    const retryInterval = setInterval(async () => {
      try {
        await this.connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: true,
          maxRetries: 0
        });
      } catch (e) {}
    }, 2000);

    try {
      const confirmation = await confirmPromise;
      clearInterval(retryInterval);

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log(`✅ Sell successful: ${signature}`);
      return { signature, success: true };
    } catch (error) {
      clearInterval(retryInterval);
      throw error;
    }
  }

  async getTokenBalance(mintAddress) {
    try {
      const mint = new PublicKey(mintAddress);
      const userToken = getAssociatedTokenAddressSync(mint, this.wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
      const balance = await this.connection.getTokenAccountBalance(userToken);
      return parseFloat(balance.value.amount) / TOKEN_DECIMALS;
    } catch {
      return 0;
    }
  }

  async getSolBalance() {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }
}

if (require.main === module) {
  const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const MINT_ADDRESS = process.env.MINT_ADDRESS;

  if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  if (!MINT_ADDRESS) {
    console.error('❌ MINT_ADDRESS environment variable required');
    process.exit(1);
  }

  const trader = new TokenTrader(RPC_URL, PRIVATE_KEY);

  const action = process.argv[2];
  const amount = parseFloat(process.argv[3]);

  if (!action || !amount) {
    console.log('Usage:');
    console.log('  Buy:  node trade.js buy <SOL_AMOUNT>');
    console.log('  Sell: node trade.js sell <TOKEN_AMOUNT>');
    process.exit(1);
  }

  (async () => {
    try {
      console.log(`💼 Wallet: ${trader.wallet.publicKey.toString()}`);
      console.log(`💰 SOL Balance: ${await trader.getSolBalance()} SOL`);
      console.log(`🪙 Token Balance: ${await trader.getTokenBalance(MINT_ADDRESS)}`);
      console.log('');

      if (action === 'buy') {
        const result = await trader.buy(MINT_ADDRESS, amount);
        console.log(`\n🎉 Bought tokens for ${amount} SOL`);
        console.log(`📝 Signature: ${result.signature}`);
      } else if (action === 'sell') {
        const result = await trader.sell(MINT_ADDRESS, amount);
        console.log(`\n🎉 Sold ${amount} tokens`);
        console.log(`📝 Signature: ${result.signature}`);
      } else {
        console.error('❌ Invalid action. Use "buy" or "sell"');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = TokenTrader;