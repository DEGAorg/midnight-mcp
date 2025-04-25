export class WalletManager {
    private ready: boolean = false;
  
    constructor() {
      setTimeout(() => { this.ready = true; }, 5000); // Simulate sync delay
    }
  
    isReady() {
      return this.ready;
    }
  
    getAddress() {
      if (!this.ready) throw new Error('Wallet not ready');
      return "mocked-address";
    }
  
    getBalance() {
      if (!this.ready) throw new Error('Wallet not ready');
      return 1000;
    }
  
    sendFunds(to: string, amount: number) {
      if (!this.ready) throw new Error('Wallet not ready');
      return { to, amount, status: "sent" };
    }
  }
  
export default WalletManager;
  