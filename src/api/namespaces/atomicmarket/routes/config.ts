import * as express from 'express';

import { AtomicMarketNamespace } from '../index';
import { HTTPServer } from '../../../server';
import { getOpenAPI3Responses } from '../../../docs';

export function configEndpoints(core: AtomicMarketNamespace, server: HTTPServer, router: express.Router): any {
    router.get('/v1/config', server.web.caching(), async (_, res) => {
        const configQuery = await core.connection.database.query(
            'SELECT * FROM atomicmarket_config WHERE market_contract = $1',
            [core.args.atomicmarket_account]
        );

        const config = configQuery.rows[0];

        const pairsQuery = await core.connection.database.query(
            'SELECT listing_symbol, settlement_symbol, delphi_pair_name, invert_delphi_pair FROM atomicmarket_symbol_pairs WHERE market_contract = $1',
            [core.args.atomicmarket_account]
        );

        const tokensQuery = await core.connection.database.query(
            'SELECT token_contract, token_symbol, token_precision FROM atomicmarket_tokens WHERE market_contract = $1',
            [core.args.atomicmarket_account]
        );

        res.json({
            success: true, data: {
                atomicassets_contract: core.args.atomicassets_account,
                atomicmarket_contract: core.args.atomicmarket_account,
                delphioracle_contract: core.args.delphioracle_account,
                version: config.version,
                maker_market_fee: config.maker_market_fee,
                taker_market_fee: config.taker_market_fee,
                maximum_auction_duration: config.maximum_auction_duration,
                minimum_bid_increase: config.minimum_bid_increase,
                supported_tokens: tokensQuery.rows,
                supported_pairs: pairsQuery.rows
            }, query_time: Date.now()
        });
    });

    return {
        tag: {
            name: 'config',
            description: 'Config'
        },
        paths: {
            '/v1/config': {
                get: {
                    tags: ['config'],
                    summary: 'Get atomicmarket config',
                    responses: getOpenAPI3Responses([200], {
                        type: 'object',
                        properties: {
                            atomicassets_contract: {type: 'string'},
                            atomicmarket_contract: {type: 'string'},
                            delphioracle_contract: {type: 'string'},
                            version: {type: 'string'},
                            maker_market_fee: {type: 'number'},
                            taker_market_fee: {type: 'number'},
                            maximum_auction_duration: {type: 'integer'},
                            minimum_bid_increase: {type: 'number'},
                            supported_tokens: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        token_contract: {type: 'string'},
                                        token_symbol: {type: 'string'},
                                        token_precision: {type: 'integer'}
                                    }
                                }
                            },
                            supported_pairs: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        listing_symbol: {type: 'string'},
                                        settlement_symbol: {type: 'string'},
                                        delphi_pair_name: {type: 'string'},
                                        invert_delphi_pair: {type: 'boolean'}
                                    }
                                }
                            }
                        }
                    })
                }
            }
        }
    };
}