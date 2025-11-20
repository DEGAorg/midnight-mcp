/**
 * DaoService
 *
 * DAO operations: elections, voting, treasury
 * Extracted from WalletServiceMCP god class
 */

import type { Logger } from 'pino';
import type { WalletManager } from '../../wallet/index.js';

export class DaoService {
  constructor(
    private readonly wallet: WalletManager,
    private readonly logger: Logger
  ) {}

  /**
   * Open DAO election
   */
  async openDaoElection(electionId: string): Promise<any> {
    this.logger.info({ electionId }, 'Opening DAO election');

    try {
      const result = await this.wallet.openDaoElection(electionId);
      this.logger.info({ electionId }, 'DAO election opened successfully');
      return result;
    } catch (error) {
      this.logger.error({ error, electionId }, 'Failed to open DAO election');
      throw error;
    }
  }

  /**
   * Close DAO election
   */
  async closeDaoElection(): Promise<any> {
    this.logger.info('Closing DAO election');

    try {
      const result = await this.wallet.closeDaoElection();
      this.logger.info('DAO election closed successfully');
      return result;
    } catch (error) {
      this.logger.error({ error }, 'Failed to close DAO election');
      throw error;
    }
  }

  /**
   * Cast DAO vote
   */
  async castDaoVote(voteType: string): Promise<any> {
    this.logger.info({ voteType }, 'Casting DAO vote');

    try {
      const result = await this.wallet.castDaoVote(voteType);
      this.logger.info({ voteType }, 'DAO vote cast successfully');
      return result;
    } catch (error) {
      this.logger.error({ error, voteType }, 'Failed to cast DAO vote');
      throw error;
    }
  }

  /**
   * Fund DAO treasury
   */
  async fundDaoTreasury(amount: string): Promise<any> {
    this.logger.info({ amount }, 'Funding DAO treasury');

    try {
      const result = await this.wallet.fundDaoTreasury(amount);
      this.logger.info({ amount }, 'DAO treasury funded successfully');
      return result;
    } catch (error) {
      this.logger.error({ error, amount }, 'Failed to fund DAO treasury');
      throw error;
    }
  }
}
