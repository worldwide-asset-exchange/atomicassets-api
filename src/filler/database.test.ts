import 'mocha';
import ConnectionManager from '../connections/manager';
import {ContractDB} from './database';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../../config/connections.config.json');

describe('database tests', () => {
    const connection = new ConnectionManager(config);
    const contract = new ContractDB('test', connection);

    it('Contract DB Transaction Insert', async () => {
        const transaction = await contract.startTransaction(1);

        await transaction.insert('contract_abis', {
            account: 'pink.gg',
            abi: new Uint8Array([0, 0, 2, 128]),
            block_num: 1,
            block_time: 0
        }, ['account', 'block_num']);

        await transaction.commit();
    });

    it('Contract DB Transaction Replace', async () => {
        const transaction = await contract.startTransaction(2);

        await transaction.replace('contract_abis', {
            account: 'pink.gg',
            abi: new Uint8Array([0, 0, 128]),
            block_num: 2,
            block_time: 1
        }, ['account', 'block_num']);

        await transaction.replace('contract_abis', {
            account: 'pink.gg',
            abi: new Uint8Array([0, 0, 128]),
            block_num: 2,
            block_time: 2
        }, ['account', 'block_num']);

        await transaction.commit();
    });

    it('Contract DB Transaction Update', async () => {
        const transaction = await contract.startTransaction(3);

        await transaction.update('contract_abis', {
            account: 'pink.gg',
            abi: new Uint8Array([0, 0, 128]),
            block_num: 2,
            block_time: 3
        }, {
            str: 'account = $1',
            values: ['pink.gg']
        }, ['account', 'block_num']);

        await transaction.commit();
    });

    it('Contract DB Transaction Delete', async () => {
        const transaction = await contract.startTransaction(4);

        await transaction.delete('contract_abis', {
            str: 'account = $1',
            values: ['pink.gg']
        });

        await transaction.commit();
    });

    it('Contract DB Rollback', async () => {
        const transaction = await contract.startTransaction(4);

        await transaction.rollbackReversibleBlocks(1);

        await transaction.commit();
    });

    after(async () => {
        await connection.redis.disconnect();
        await connection.database.pool.end();
    });
});
